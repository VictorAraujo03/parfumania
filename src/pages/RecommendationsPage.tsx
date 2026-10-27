import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Library, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button, ButtonLink } from '../components/Button';
import { ChipSingleSelect } from '../components/ChipGroup';
import { PerfumeImage } from '../components/PerfumeImage';
import { Card, CardHeader, EmptyState, Notice, PageHeader } from '../components/ui';
import {
  ENVIRONMENTS,
  FAMILIES,
  INTENSITY_PREFERENCES,
  OCCASIONS,
  PERIODS,
  labelOf,
} from '../data/options';
import { RecommendationCard } from '../features/recommendations/RecommendationCard';
import { UsageDialog } from '../features/usage/UsageDialog';
import { WeatherWidget } from '../features/weather/WeatherWidget';
import { useAppData } from '../hooks/useAppData';
import { useRecommendations } from '../hooks/useRecommendations';
import { useWeather } from '../hooks/useWeather';
import type { RecommendationContext } from '../services/recommendations/engine';
import { CRITERIA, normalizeWeights } from '../services/recommendations/weights';
import type { DayPeriod, Environment, IntensityPreference, Occasion, OlfactoryFamily } from '../types';
import { getDayPeriod } from '../utils/date';

interface Answers {
  occasion?: Occasion;
  environment?: Environment;
  intensity?: IntensityPreference;
  family?: OlfactoryFamily;
}

const STEPS = [
  { key: 'occasion', question: 'Qual é a ocasião?' },
  { key: 'environment', question: 'Você estará em ambiente fechado, aberto ou ambos?' },
  { key: 'intensity', question: 'Prefere uma fragrância discreta, moderada ou marcante?' },
  { key: 'family', question: 'Há alguma preferência específica para hoje?' },
] as const;

export function RecommendationsPage() {
  const { perfumes, settings } = useAppData();
  const weather = useWeather();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [period, setPeriod] = useState<DayPeriod>(getDayPeriod());
  const [showAll, setShowAll] = useState(false);
  const [registerFor, setRegisterFor] = useState<{ id: string } | null>(null);

  const context: RecommendationContext = useMemo(
    () => ({
      weather: weather.snapshot
        ? {
            temperatureC: weather.snapshot.temperatureC,
            humidity: weather.snapshot.humidity,
            precipitationProbability: weather.snapshot.precipitationProbability,
          }
        : undefined,
      period,
      occasion: answers.occasion,
      environment: answers.environment,
      intensity: answers.intensity,
      preferredFamily: answers.family,
    }),
    [weather.snapshot, period, answers],
  );
  const result = useRecommendations(context);
  const weights = normalizeWeights(settings.weights);
  const eligible = perfumes.filter((p) => p.status === 'owned' || p.status === 'decant');

  const setAnswer = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }));
  const current = STEPS[step];
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : setDone(true));

  if (eligible.length === 0) {
    return (
      <div className="page">
        <PageHeader eyebrow="Recomendações" title="O que usar hoje?" />
        <EmptyState
          icon={Library}
          title="Nenhum perfume disponível"
          action={
            <ButtonLink to="/colecao/novo" variant="primary" icon={Plus}>
              Adicionar perfume
            </ButtonLink>
          }
        >
          As recomendações consideram apenas perfumes que você possui (status “Na coleção” ou “Amostra / decant”).
        </EmptyState>
      </div>
    );
  }

  const visible = showAll ? result.recommendations : result.recommendations.slice(0, 5);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Recomendações"
        title="O que usar hoje?"
        description="Responda algumas perguntas. Tudo é opcional — critérios sem resposta simplesmente não são considerados."
      />

      <div className="rec-layout">
        <div className="rec-layout__main">
          {!done ? (
            <Card className="wizard">
              <div className="wizard__progress" aria-hidden>
                {STEPS.map((s, i) => (
                  <span key={s.key} className={i <= step ? 'is-on' : ''} />
                ))}
              </div>
              <p className="eyebrow">
                Pergunta {step + 1} de {STEPS.length}
              </p>
              <h2 className="wizard__question">{current.question}</h2>
              <div className="wizard__options">
                {current.key === 'occasion' && (
                  <ChipSingleSelect large options={OCCASIONS} value={answers.occasion} onChange={(v) => setAnswer('occasion', v)} ariaLabel="Ocasião" />
                )}
                {current.key === 'environment' && (
                  <ChipSingleSelect large options={ENVIRONMENTS} value={answers.environment} onChange={(v) => setAnswer('environment', v)} ariaLabel="Ambiente" />
                )}
                {current.key === 'intensity' && (
                  <>
                    <ChipSingleSelect large options={INTENSITY_PREFERENCES} value={answers.intensity} onChange={(v) => setAnswer('intensity', v)} ariaLabel="Intensidade" />
                    {settings.preferredIntensity && !answers.intensity && (
                      <p className="field__hint">
                        Sem resposta, será usada sua preferência padrão:{' '}
                        {labelOf(INTENSITY_PREFERENCES, settings.preferredIntensity).toLowerCase()}.
                      </p>
                    )}
                  </>
                )}
                {current.key === 'family' && (
                  <>
                    <p className="field__hint">Escolha uma família olfativa se quiser priorizá-la hoje.</p>
                    <ChipSingleSelect options={FAMILIES.filter((f) => f.value !== 'other')} value={answers.family} onChange={(v) => setAnswer('family', v)} ariaLabel="Família preferida hoje" />
                  </>
                )}
              </div>
              <div className="wizard__nav">
                <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)} disabled={step === 0}>
                  Voltar
                </Button>
                <div className="wizard__nav-right">
                  <Button variant="ghost" onClick={() => setDone(true)}>
                    Ver resultados agora
                  </Button>
                  <Button variant="primary" onClick={next}>
                    {step === STEPS.length - 1 ? 'Ver recomendações' : 'Próxima'}
                    <ArrowRight size={16} aria-hidden />
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="answers-bar">
                <span className="muted small">Sua situação:</span>
                {[
                  labelOf(OCCASIONS, answers.occasion),
                  labelOf(ENVIRONMENTS, answers.environment),
                  labelOf(INTENSITY_PREFERENCES, answers.intensity),
                  labelOf(FAMILIES, answers.family),
                ]
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t} className="chip chip--static">
                      {t}
                    </span>
                  ))}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => {
                    setDone(false);
                    setStep(0);
                  }}
                >
                  Alterar respostas
                </Button>
              </div>

              {result.insufficientData ? (
                <>
                  <Notice tone="warning" icon={Info}>
                    Seus perfumes ainda não têm informações suficientes (climas, ocasiões, períodos, projeção ou
                    avaliações) para uma recomendação confiável. Escolha manualmente abaixo ou{' '}
                    <Link to="/colecao">complete os dados da coleção</Link>.
                  </Notice>
                  <Card>
                    <CardHeader title="Escolha manual" />
                    <ul className="manual-pick">
                      {eligible.map((p) => (
                        <li key={p.id}>
                          <PerfumeImage imageId={p.imageId} name={p.name} brand={p.brand} family={p.family} className="manual-pick__thumb" />
                          <div>
                            <Link to={`/colecao/${p.id}`} className="manual-pick__name">
                              {p.name}
                            </Link>
                            <span className="muted small">{p.brand}</span>
                          </div>
                          <Button size="sm" onClick={() => setRegisterFor({ id: p.id })}>
                            Registrar uso
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              ) : (
                <div className="rec-list">
                  {visible.map((r, i) => (
                    <RecommendationCard key={r.perfume.id} rec={r} rank={i + 1} featured={i === 0} onRegister={(x) => setRegisterFor({ id: x.perfume.id })} />
                  ))}
                  {result.recommendations.length > 5 && (
                    <Button variant="ghost" onClick={() => setShowAll((s) => !s)}>
                      {showAll ? 'Mostrar menos' : `Ver todos os ${result.recommendations.length} perfumes`}
                    </Button>
                  )}
                </div>
              )}
              {result.excluded.length > 0 && (
                <p className="muted small">
                  {result.excluded.length} perfume(s) não foram considerados por não estarem disponíveis (desejados,
                  acabados, vendidos ou com 0 ml).
                </p>
              )}
            </>
          )}
        </div>

        <aside className="rec-layout__side">
          <Card>
            <CardHeader title="Clima agora" />
            <WeatherWidget compact />
          </Card>
          <Card>
            <CardHeader title="Período do dia" subtitle="Detectado pelo horário; altere se necessário." />
            <ChipSingleSelect options={PERIODS} value={period} onChange={(v) => v && setPeriod(v)} allowClear={false} ariaLabel="Período" />
          </Card>
          <Card>
            <CardHeader
              title="Como pontuamos"
              subtitle={
                <>
                  Pesos atuais — ajuste em <Link to="/configuracoes">Configurações</Link>.
                </>
              }
            />
            <ul className="weights-list">
              {CRITERIA.map((c) => (
                <li key={c.key}>
                  <span>{c.label}</span>
                  <strong>{Math.round(weights[c.key])} pts</strong>
                </li>
              ))}
            </ul>
            <p className="muted small">
              <Sparkles size={12} aria-hidden /> Perfumes com dados incompletos recebem menor confiança — nada é
              inventado.
            </p>
          </Card>
        </aside>
      </div>

      <UsageDialog
        open={!!registerFor}
        perfumeId={registerFor?.id}
        defaults={{ occasion: answers.occasion, environment: answers.environment }}
        onClose={() => setRegisterFor(null)}
      />
    </div>
  );
}

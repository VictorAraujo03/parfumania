import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Droplet, Heart, Library, Plus, Sparkles, Wand2 } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { ChipSingleSelect } from '../components/ChipGroup';
import { PerfumeImage } from '../components/PerfumeImage';
import { Card, CardHeader, EmptyState, StatTile } from '../components/ui';
import { DemoBanner } from '../features/collection/DemoBanner';
import { RecommendationCard } from '../features/recommendations/RecommendationCard';
import { buildBriefing } from '../features/recommendations/briefing';
import { sceneOf } from '../features/weather/scene';
import { useLocalPref } from '../hooks/useLocalPref';
import { countByPerfume, filterLogs, indexPerfumes, byWeekday } from '../features/statistics/stats';
import { UsageDialog } from '../features/usage/UsageDialog';
import { WeatherWidget } from '../features/weather/WeatherWidget';
import { useAppData } from '../hooks/useAppData';
import { useRecommendations } from '../hooks/useRecommendations';
import { useWeather } from '../hooks/useWeather';
import { ENVIRONMENTS, OCCASIONS, PERIODS, labelOf } from '../data/options';
import type { Environment, Occasion } from '../types';
import { addDays, formatLongDate, getDayPeriod, greeting, startOfWeek, toDateKey } from '../utils/date';
import { formatTemperature, pluralize } from '../utils/format';

/** Ocasiões oferecidas no atalho do painel (as demais ficam na recomendação guiada). */
const QUICK_OCCASIONS = OCCASIONS.filter((o) => ['work', 'daily', 'casual', 'date', 'party', 'home'].includes(o.value));

/** Respostas rápidas do dia ("para onde você vai?"); valem só para a data salva. */
interface MomentAnswers {
  date: string;
  occasion?: Occasion;
  environment?: Environment;
}

export function DashboardPage() {
  const { perfumes, usageLogs, settings } = useAppData();
  const weather = useWeather();
  const [registerFor, setRegisterFor] = useState<string | null>(null);
  const now = new Date();
  const period = getDayPeriod(now);
  const today = toDateKey(now);
  const [savedMoment, setMoment] = useLocalPref<MomentAnswers>('moment', { date: today });
  const moment = savedMoment.date === today ? savedMoment : { date: today };
  const answer = (patch: Partial<MomentAnswers>) => setMoment({ ...moment, ...patch, date: today });

  const context = useMemo(
    () => ({
      weather: weather.snapshot
        ? {
            temperatureC: weather.snapshot.temperatureC,
            apparentTemperatureC: weather.snapshot.apparentTemperatureC,
            humidity: weather.snapshot.humidity,
            precipitationProbability: weather.snapshot.precipitationProbability,
          }
        : undefined,
      period,
      occasion: moment.occasion,
      environment: moment.environment,
    }),
    [weather.snapshot, period, moment.occasion, moment.environment],
  );
  const { recommendations, insufficientData } = useRecommendations(context);
  const top = recommendations[0];
  const scene = useMemo(
    () => (weather.snapshot ? sceneOf(weather.snapshot, settings.climateThresholds) : undefined),
    [weather.snapshot, settings.climateThresholds],
  );
  const briefing = useMemo(
    () =>
      top
        ? buildBriefing(top, {
            period,
            temperatureC: weather.snapshot?.apparentTemperatureC ?? weather.snapshot?.temperatureC,
            scene,
            occasion: moment.occasion,
            environment: moment.environment,
            logs: usageLogs,
            formatTemperature: (c) => formatTemperature(c, settings.temperatureUnit),
          })
        : undefined,
    [top, period, weather.snapshot, scene, moment.occasion, moment.environment, usageLogs, settings.temperatureUnit],
  );
  const alternatives = recommendations.slice(1, 3).filter((r) => r.confidenceLevel !== 'low' && r.score > 0);

  const index = useMemo(() => indexPerfumes(perfumes), [perfumes]);
  const weekStart = startOfWeek(now);
  const weekLogs = useMemo(
    () => filterLogs(usageLogs, { start: weekStart, end: addDays(weekStart, 7) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usageLogs, weekStart.getTime()],
  );
  const mostUsed = useMemo(() => countByPerfume(usageLogs, index).slice(0, 3), [usageLogs, index]);
  const weekdays = useMemo(() => byWeekday(weekLogs), [weekLogs]);
  const weekTop = useMemo(() => countByPerfume(weekLogs, index)[0], [weekLogs, index]);
  const favorites = perfumes.filter((p) => p.favorite);
  const active = perfumes.filter((p) => p.status === 'owned' || p.status === 'decant');
  const maxDay = Math.max(1, ...weekdays.map((d) => d.value));

  return (
    <div className="page dashboard">
      <header className="dash-hero">
        <div>
          <p className="eyebrow">{formatLongDate(now)}</p>
          <h1 className="page-title">
            {greeting(now)}
            {settings.displayName ? `, ${settings.displayName}` : ''}.
          </h1>
          <p className="page-description">
            Sua sugestão para a {labelOf(PERIODS, period).toLowerCase()}, com base na sua coleção
            {weather.snapshot ? ' e no clima atual' : ''}.
          </p>
        </div>
      </header>

      <DemoBanner />

      <div className="dash-grid">
        <Card className="dash-rec">
          <CardHeader
            title="Recomendação do momento"
            subtitle={briefing?.moment}
            action={
              <Link to="/recomendacoes" className="link-subtle">
                Refinar <ArrowRight size={14} aria-hidden />
              </Link>
            }
          />
          {active.length === 0 ? (
            <EmptyState
              icon={Library}
              title="Sua coleção está vazia"
              action={
                <ButtonLink to="/colecao/novo" variant="primary" icon={Plus}>
                  Adicionar perfume
                </ButtonLink>
              }
            >
              Cadastre seus perfumes para receber recomendações.
            </EmptyState>
          ) : insufficientData || !top ? (
            <EmptyState
              icon={Wand2}
              title="Informações insuficientes"
              action={
                <ButtonLink to="/recomendacoes" variant="primary">
                  Escolher manualmente
                </ButtonLink>
              }
            >
              Seus perfumes ainda não têm climas, períodos ou avaliações suficientes para uma recomendação confiável.
              Complete os dados na coleção ou escolha manualmente.
            </EmptyState>
          ) : (
            <>
              <RecommendationCard rec={top} featured briefing={briefing} onRegister={(r) => setRegisterFor(r.perfume.id)} />
              {alternatives.length > 0 && (
                <div className="moment-alts">
                  <p className="briefing__title">Também combinam agora</p>
                  <ul>
                    {alternatives.map((a) => (
                      <li key={a.perfume.id}>
                        <Link to={`/colecao/${a.perfume.id}`} className="moment-alts__name">
                          {a.perfume.name}
                          <span>{a.perfume.brand}</span>
                        </Link>
                        <span className="moment-alts__why">{a.highlights[0] ?? a.caveats[0] ?? ''}</span>
                        <span className="moment-alts__score">{a.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {active.length > 0 && (
            <div className="moment-ask">
              <div className="moment-ask__row">
                <span className="moment-ask__label">Para onde você vai?</span>
                <ChipSingleSelect
                  options={QUICK_OCCASIONS}
                  value={moment.occasion}
                  onChange={(v) => answer({ occasion: v })}
                  ariaLabel="Ocasião de hoje"
                />
              </div>
              <div className="moment-ask__row">
                <span className="moment-ask__label">Onde vai ficar?</span>
                <ChipSingleSelect
                  options={ENVIRONMENTS}
                  value={moment.environment}
                  onChange={(v) => answer({ environment: v })}
                  ariaLabel="Ambiente de hoje"
                />
              </div>
              <p className="moment-ask__hint">
                Opcional — deixa a sugestão mais precisa e vale só para hoje. Toque de novo para desmarcar.
              </p>
            </div>
          )}
        </Card>

        <Card className="dash-weather card--weather">
          <WeatherWidget title="Clima" />
        </Card>
      </div>

      <div className="stat-row">
        <StatTile to="/colecao" icon={Library} label="Na coleção" value={active.length} detail={`${pluralize(perfumes.length, 'cadastrado', 'cadastrados')} no total`} />
        <StatTile to="/estatisticas?aba=retrospectiva" icon={Droplet} label="Usos nesta semana" value={weekLogs.length} detail={weekTop ? `Mais usado: ${weekTop.perfume?.name ?? '—'}` : 'Nenhum registro ainda'} />
        <StatTile to="/colecao?favoritos=1" icon={Heart} label="Favoritos" value={favorites.length} detail={favorites.length ? 'Ver seus favoritos' : 'Nenhum ainda'} />
        <StatTile to="/estatisticas?aba=historico&periodo=all" icon={BarChart3} label="Registros no total" value={usageLogs.length} detail="Ver histórico" />
      </div>

      <div className="dash-grid dash-grid--even">
        <Card>
          <CardHeader title="Esta semana" subtitle="Utilizações registradas por dia" />
          {weekLogs.length === 0 ? (
            <EmptyState icon={Droplet} title="Nenhuma utilização nesta semana" compact>
              Registre o perfume que você está usando para começar suas estatísticas.
            </EmptyState>
          ) : (
            <div className="mini-bars" role="img" aria-label="Utilizações por dia da semana">
              {weekdays.map((d) => (
                <div key={d.name} className="mini-bars__col">
                  <span className="mini-bars__value">{d.value || ''}</span>
                  <span className="mini-bars__bar" style={{ height: `${(d.value / maxDay) * 100}%` }} />
                  <span className="mini-bars__label">{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Mais utilizados"
            action={
              <Link to="/estatisticas" className="link-subtle">
                Estatísticas <ArrowRight size={14} aria-hidden />
              </Link>
            }
          />
          {mostUsed.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem histórico ainda" compact>
              Seus perfumes mais usados aparecerão aqui.
            </EmptyState>
          ) : (
            <ol className="rank-list">
              {mostUsed.map((m, i) => (
                <li key={m.perfumeId}>
                  <span className="rank-list__pos">{i + 1}</span>
                  {m.perfume ? <Link to={`/colecao/${m.perfumeId}`}>{m.name}</Link> : <span>{m.name}</span>}
                  <span className="rank-list__count">{pluralize(m.count, 'uso', 'usos')}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Favoritos"
          action={
            <Link to="/colecao" className="link-subtle">
              Coleção <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {favorites.length === 0 ? (
          <EmptyState icon={Heart} title="Nenhum favorito" compact>
            Toque no coração de um perfume para destacá-lo aqui.
          </EmptyState>
        ) : (
          <div className="fav-strip">
            {favorites.map((p) => (
              <Link key={p.id} to={`/colecao/${p.id}`} className="fav-strip__item">
                <PerfumeImage imageId={p.imageId} name={p.name} brand={p.brand} family={p.family} />
                <span className="fav-strip__name">{p.name}</span>
                <span className="fav-strip__brand">{p.brand}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="quick-links">
        <Link to="/colecao" className="quick-link">
          <Library size={20} strokeWidth={1.5} aria-hidden />
          <span>Ver coleção</span>
        </Link>
        <Link to="/colecao/novo" className="quick-link">
          <Plus size={20} strokeWidth={1.5} aria-hidden />
          <span>Cadastrar perfume</span>
        </Link>
        <Link to="/recomendacoes" className="quick-link">
          <Sparkles size={20} strokeWidth={1.5} aria-hidden />
          <span>Recomendação guiada</span>
        </Link>
        <button type="button" className="quick-link" onClick={() => setRegisterFor('')}>
          <Droplet size={20} strokeWidth={1.5} aria-hidden />
          <span>Registrar uso</span>
        </button>
      </div>

      <UsageDialog
        open={registerFor !== null}
        perfumeId={registerFor || undefined}
        onClose={() => setRegisterFor(null)}
      />
    </div>
  );
}

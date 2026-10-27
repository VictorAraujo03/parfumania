import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Droplet, Heart, Library, Plus, Sparkles, Wand2 } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { PerfumeImage } from '../components/PerfumeImage';
import { Card, CardHeader, EmptyState, StatTile } from '../components/ui';
import { DemoBanner } from '../features/collection/DemoBanner';
import { RecommendationCard } from '../features/recommendations/RecommendationCard';
import { countByPerfume, filterLogs, indexPerfumes, byWeekday } from '../features/statistics/stats';
import { UsageDialog } from '../features/usage/UsageDialog';
import { WeatherWidget } from '../features/weather/WeatherWidget';
import { useAppData } from '../hooks/useAppData';
import { useRecommendations } from '../hooks/useRecommendations';
import { useWeather } from '../hooks/useWeather';
import { PERIODS, labelOf } from '../data/options';
import { addDays, formatLongDate, getDayPeriod, greeting, startOfWeek } from '../utils/date';
import { pluralize } from '../utils/format';

export function DashboardPage() {
  const { perfumes, usageLogs, settings } = useAppData();
  const weather = useWeather();
  const [registerFor, setRegisterFor] = useState<string | null>(null);
  const now = new Date();
  const period = getDayPeriod(now);

  const context = useMemo(
    () => ({
      weather: weather.snapshot
        ? {
            temperatureC: weather.snapshot.temperatureC,
            humidity: weather.snapshot.humidity,
            precipitationProbability: weather.snapshot.precipitationProbability,
          }
        : undefined,
      period,
    }),
    [weather.snapshot, period],
  );
  const { recommendations, insufficientData } = useRecommendations(context);
  const top = recommendations[0];

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
            <RecommendationCard rec={top} featured onRegister={(r) => setRegisterFor(r.perfume.id)} />
          )}
        </Card>

        <Card className="dash-weather">
          <CardHeader title="Clima" />
          <WeatherWidget />
        </Card>
      </div>

      <div className="stat-row">
        <StatTile icon={Library} label="Na coleção" value={active.length} detail={`${pluralize(perfumes.length, 'cadastrado', 'cadastrados')} no total`} />
        <StatTile icon={Droplet} label="Usos nesta semana" value={weekLogs.length} detail={weekTop ? `Mais usado: ${weekTop.perfume?.name ?? '—'}` : 'Nenhum registro ainda'} />
        <StatTile icon={Heart} label="Favoritos" value={favorites.length} />
        <StatTile icon={BarChart3} label="Registros no total" value={usageLogs.length} />
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

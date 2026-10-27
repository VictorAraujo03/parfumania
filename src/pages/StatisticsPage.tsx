import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, Droplet, Layers, Moon, Sparkle } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardHeader, EmptyState, PageHeader, StatTile, Tabs } from '../components/ui';
import { BarList, ColumnChart, TimelineChart } from '../features/statistics/charts';
import {
  RANGE_OPTIONS,
  byBrand,
  byFamily,
  byWeekday,
  countByPerfume,
  filterLogs,
  indexPerfumes,
  monthlyComparison,
  rangeFor,
  timeline,
  topBetween,
  topByOccasion,
  underused,
  weeklyComparison,
  type PerfumeCount,
  type StatsRangeKey,
} from '../features/statistics/stats';
import { WeeklyRecap } from '../features/statistics/WeeklyRecap';
import { UsageDialog } from '../features/usage/UsageDialog';
import { UsageLogList } from '../features/usage/UsageLogList';
import { useAppData } from '../hooks/useAppData';
import { useLocalPref } from '../hooks/useLocalPref';
import { addDays, addMonths, daysBetween, formatDate, startOfMonth, startOfWeek, toDateKey } from '../utils/date';
import { pluralize } from '../utils/format';

type Tab = 'overview' | 'recap' | 'history';

function TopThree({ items, empty }: { items: PerfumeCount[]; empty: string }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <ol className="rank-list">
      {items.map((m, i) => (
        <li key={m.perfumeId}>
          <span className="rank-list__pos">{i + 1}</span>
          {m.perfume ? <Link to={`/colecao/${m.perfumeId}`}>{m.name}</Link> : <span>{m.name}</span>}
          <span className="rank-list__count">{pluralize(m.count, 'uso', 'usos')}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatisticsPage() {
  const { perfumes, usageLogs } = useAppData();
  const [rangeKey, setRangeKey] = useLocalPref<StatsRangeKey>('statsRange', '30d');
  const [tab, setTab] = useState<Tab>('overview');
  const [registerOpen, setRegisterOpen] = useState(false);

  const now = new Date();
  const index = useMemo(() => indexPerfumes(perfumes), [perfumes]);
  const range = useMemo(() => rangeFor(rangeKey), [rangeKey]);
  const logs = useMemo(() => filterLogs(usageLogs, range), [usageLogs, range]);

  const stats = useMemo(() => {
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const firstLog = usageLogs.reduce<string | undefined>((m, l) => (!m || l.usedAt < m ? l.usedAt : m), undefined);
    const spanDays = Math.max(1, daysBetween(range.start ?? (firstLog ? new Date(firstLog) : now), now) + 1);
    return {
      top: countByPerfume(logs, index).map((c) => ({ name: c.name, value: c.count })),
      topWeek: topBetween(usageLogs, index, weekStart, addDays(weekStart, 7)),
      topMonth: topBetween(usageLogs, index, monthStart, addMonths(monthStart, 1)),
      occasions: topByOccasion(logs, index),
      brands: byBrand(logs, index),
      families: byFamily(logs, index),
      weekday: byWeekday(logs),
      series: timeline(logs, range),
      weeks: weeklyComparison(usageLogs, now),
      months: monthlyComparison(usageLogs, now),
      underused: underused(perfumes, logs, now),
      distinct: new Set(logs.map((l) => l.perfumeId)).size,
      perWeek: (logs.length / spanDays) * 7,
      activeDays: new Set(logs.map((l) => toDateKey(new Date(l.usedAt)))).size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, usageLogs, index, perfumes, range]);

  const header = (
    <PageHeader
      eyebrow="Estatísticas"
      title="Seus hábitos olfativos"
      description="Calculadas exclusivamente a partir dos seus registros de utilização."
      actions={
        <Button variant="primary" icon={Droplet} onClick={() => setRegisterOpen(true)}>
          Registrar uso
        </Button>
      }
    />
  );
  const dialog = <UsageDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />;

  if (usageLogs.length === 0) {
    return (
      <div className="page">
        {header}
        <EmptyState
          icon={BarChart3}
          title="Ainda não há registros"
          action={
            <Button variant="primary" icon={Droplet} onClick={() => setRegisterOpen(true)}>
              Registrar a primeira utilização
            </Button>
          }
        >
          Cada vez que você registrar o perfume do dia, suas estatísticas, rankings e a retrospectiva semanal ganham
          forma. Nenhum dado fictício é exibido aqui.
        </EmptyState>
        {dialog}
      </div>
    );
  }

  const wk = stats.weeks;
  const weekDelta = wk[wk.length - 1].value - wk[wk.length - 2].value;
  const mo = stats.months;
  const monthDelta = mo[mo.length - 1].value - mo[mo.length - 2].value;
  const delta = (n: number) => (n === 0 ? 'igual ao anterior' : `${n > 0 ? '+' : ''}${n} vs. anterior`);

  return (
    <div className="page">
      {header}

      <div className="stats-controls">
        <Tabs
          ariaLabel="Seções de estatísticas"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Visão geral' },
            { value: 'recap', label: 'Retrospectiva' },
            { value: 'history', label: 'Histórico' },
          ]}
        />
        {tab !== 'recap' && (
          <div className="segmented segmented--text" role="group" aria-label="Período">
            {RANGE_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={rangeKey === o.value ? 'is-active' : ''} aria-pressed={rangeKey === o.value} onClick={() => setRangeKey(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'recap' && <WeeklyRecap />}

      {tab === 'history' && (
        <Card>
          <CardHeader
            title="Histórico de utilizações"
            subtitle={range.start ? `Desde ${formatDate(range.start)}` : 'Todo o período'}
          />
          {logs.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhum registro neste período" compact />
          ) : (
            <UsageLogList logs={logs} limit={30} />
          )}
        </Card>
      )}

      {tab === 'overview' && (
        <>
          <div className="stat-row">
            <StatTile icon={Droplet} label="Utilizações" value={logs.length} detail={`${pluralize(usageLogs.length, 'registro', 'registros')} no total`} />
            <StatTile icon={Layers} label="Perfumes usados" value={stats.distinct} detail={`de ${perfumes.filter((p) => p.status === 'owned' || p.status === 'decant').length} disponíveis`} />
            <StatTile icon={CalendarDays} label="Dias com registro" value={stats.activeDays} />
            <StatTile icon={Sparkle} label="Média semanal" value={stats.perWeek.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} detail="utilizações por semana" />
          </div>

          {logs.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhum registro neste período" compact>
              Escolha um período maior para ver as estatísticas.
            </EmptyState>
          ) : (
            <div className="stats-grid">
              <Card className="stats-grid__wide">
                <CardHeader title="Frequência de utilização" subtitle="Utilizações no período selecionado" />
                <TimelineChart data={stats.series} />
              </Card>

              <Card>
                <CardHeader title="Perfumes mais utilizados" />
                <BarList data={stats.top} />
              </Card>

              <Card>
                <CardHeader title="Rankings" />
                <div className="stack">
                  <div>
                    <h3 className="mini-title">Top 3 da semana</h3>
                    <TopThree items={stats.topWeek} empty="Nenhum uso nesta semana." />
                  </div>
                  <div>
                    <h3 className="mini-title">Top 3 do mês</h3>
                    <TopThree items={stats.topMonth} empty="Nenhum uso neste mês." />
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Mais usado por ocasião" subtitle="Apenas registros com ocasião informada" />
                {stats.occasions.length === 0 ? (
                  <p className="muted small">Nenhum registro com ocasião no período.</p>
                ) : (
                  <ul className="occasion-list">
                    {stats.occasions.map((o) => (
                      <li key={o.occasion}>
                        <span className="occasion-list__label">{o.label}</span>
                        <span className="occasion-list__perfume">{o.top.name}</span>
                        <span className="muted small">
                          {o.top.count}/{o.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Por dia da semana" />
                <ColumnChart data={stats.weekday} nameHeader="Dia" height={200} />
              </Card>

              <Card>
                <CardHeader title="Por marca" />
                <BarList data={stats.brands} max={6} />
              </Card>

              <Card>
                <CardHeader title="Por família olfativa" />
                <BarList data={stats.families} max={6} />
              </Card>

              <Card>
                <CardHeader title="Comparação entre semanas" subtitle={`Esta semana: ${delta(weekDelta)}`} />
                <ColumnChart data={stats.weeks} nameHeader="Semana" height={200} />
              </Card>

              <Card>
                <CardHeader title="Comparação entre meses" subtitle={`Este mês: ${delta(monthDelta)}`} />
                <ColumnChart data={stats.months} nameHeader="Mês" height={200} />
              </Card>

              <Card className="stats-grid__wide">
                <CardHeader title="Perfumes pouco utilizados" subtitle="Disponíveis na coleção, com menos usos no período" />
                {stats.underused.length === 0 ? (
                  <p className="muted small">Nenhum perfume disponível.</p>
                ) : (
                  <ul className="underused">
                    {stats.underused.map((u) => (
                      <li key={u.perfume.id}>
                        <Moon size={14} aria-hidden className="muted" />
                        <Link to={`/colecao/${u.perfume.id}`}>{u.perfume.name}</Link>
                        <span className="muted small">
                          {u.count === 0
                            ? 'sem uso no período'
                            : `${pluralize(u.count, 'uso', 'usos')} · último ${u.daysSince ? `há ${pluralize(u.daysSince, 'dia', 'dias')}` : 'hoje'}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

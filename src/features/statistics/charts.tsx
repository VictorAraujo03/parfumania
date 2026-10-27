import { useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import type { Slice } from './stats';

/**
 * Gráficos de série única: um só tom (--chart-1, validado para contraste e
 * croma nos dois temas), marcas finas, grade recessiva, tooltip ao passar o
 * mouse e alternância para tabela.
 */

const AXIS_TICK = { fill: 'var(--text-faint)', fontSize: 11 };

function ChartTooltip({ active, payload, label, unit }: TooltipProps<number, string> & { unit: [string, string] }) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value ?? 0);
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label}</span>
      <span className="chart-tooltip__value">
        {v} {v === 1 ? unit[0] : unit[1]}
      </span>
    </div>
  );
}

function DataTable({ data, nameHeader, valueHeader }: { data: Slice[]; nameHeader: string; valueHeader: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{nameHeader}</th>
            <th scope="col" className="num">
              {valueHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.name}-${i}`}>
              <td>{d.name}</td>
              <td className="num">{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ChartFrameProps {
  data: Slice[];
  nameHeader: string;
  children: ReactNode;
}

/** Envolve um gráfico com o botão "ver como tabela". */
function ChartFrame({ data, nameHeader, children }: ChartFrameProps) {
  const [table, setTable] = useState(false);
  return (
    <div className="chart-frame">
      <button type="button" className="chart-frame__toggle" onClick={() => setTable((t) => !t)} aria-pressed={table}>
        {table ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
        {table ? 'Ver gráfico' : 'Ver tabela'}
      </button>
      {table ? <DataTable data={data} nameHeader={nameHeader} valueHeader="Utilizações" /> : children}
    </div>
  );
}

export function ColumnChart({ data, nameHeader, height = 220 }: { data: Slice[]; nameHeader: string; height?: number }) {
  return (
    <ChartFrame data={data} nameHeader={nameHeader}>
      <div style={{ height }} role="img" aria-label={`Gráfico de colunas: utilizações por ${nameHeader.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--chart-cursor)' }} content={<ChartTooltip unit={['uso', 'usos']} />} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function TimelineChart({ data, height = 220 }: { data: Slice[]; height?: number }) {
  return (
    <ChartFrame data={data} nameHeader="Data">
      <div style={{ height }} role="img" aria-label="Gráfico de área: utilizações ao longo do tempo">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="timeline-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<ChartTooltip unit={['uso', 'usos']} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#timeline-fill)"
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--chart-1)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Barras horizontais em HTML, com rótulos diretos (sem legenda necessária). */
export function BarList({ data, max = 8, unit = ['uso', 'usos'] }: { data: Slice[]; max?: number; unit?: [string, string] }) {
  const shown = data.slice(0, max);
  const rest = data.slice(max).reduce((s, d) => s + d.value, 0);
  const rows = rest > 0 ? [...shown, { name: 'Outros', value: rest }] : shown;
  const top = Math.max(1, ...rows.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className="bar-list">
      {rows.map((d) => (
        <li key={d.name} className="bar-list__row" title={`${d.name}: ${d.value} ${d.value === 1 ? unit[0] : unit[1]}`}>
          <div className="bar-list__text">
            <span className="bar-list__name">{d.name}</span>
            <span className="bar-list__value">
              {d.value} <span className="muted">· {Math.round((d.value / total) * 100)}%</span>
            </span>
          </div>
          <span className="bar-list__track" aria-hidden>
            <span style={{ width: `${(d.value / top) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/Button';
import { useAppData } from '../../hooks/useAppData';
import { addDays, formatShortDate, startOfWeek } from '../../utils/date';
import { pluralize } from '../../utils/format';
import { indexPerfumes, weeklyRecap } from './stats';

/** Retrospectiva da semana, 100% calculada a partir dos registros. */
export function WeeklyRecap() {
  const { perfumes, usageLogs } = useAppData();
  const [offset, setOffset] = useState(0);
  const index = useMemo(() => indexPerfumes(perfumes), [perfumes]);
  const weekStart = addDays(startOfWeek(new Date()), -7 * offset);
  const recap = useMemo(() => weeklyRecap(usageLogs, index, weekStart), [usageLogs, index, weekStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const diff = recap.total - recap.previousTotal;
  const range = `${formatShortDate(recap.start)} – ${formatShortDate(recap.end)}`;
  const title = offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana passada' : `Semana de ${formatShortDate(recap.start)}`;

  return (
    <section className="recap" aria-label="Retrospectiva semanal">
      <div className="recap__nav">
        <Button variant="ghost" size="sm" iconOnly icon={ChevronLeft} aria-label="Semana anterior" onClick={() => setOffset(offset + 1)} />
        <div className="recap__period">
          <span className="recap__eyebrow">Retrospectiva</span>
          <span className="recap__range">
            {title} · {range}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={ChevronRight}
          aria-label="Próxima semana"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 1)}
        />
      </div>

      {recap.total === 0 ? (
        <div className="recap__empty">
          <p className="recap__headline">Nenhuma utilização registrada nesta semana.</p>
          <p className="recap__line">
            {offset === 0
              ? 'Registre o perfume que você usar hoje — sua retrospectiva começa no primeiro registro.'
              : 'Navegue para outra semana ou registre usos passados com a data correta.'}
          </p>
        </div>
      ) : (
        <div className="recap__body">
          <p className="recap__headline">
            {offset === 0 ? 'Esta semana você registrou' : 'Nesta semana você registrou'}{' '}
            <strong>
              <span className="recap__num">{recap.total}</span> {recap.total === 1 ? 'utilização' : 'utilizações'}
            </strong>
            .
          </p>
          {recap.top[0] && (
            <p className="recap__line">
              Seu perfume mais utilizado foi <strong>{recap.top[0].name}</strong>
              {recap.top[0].count > 1 ? ` (${recap.top[0].count} vezes)` : ''}.
            </p>
          )}
          {recap.top.length > 1 && (
            <div className="recap__top">
              <span className="recap__label">Seu top {recap.top.length} da semana</span>
              <ol>
                {recap.top.map((t) => (
                  <li key={t.perfumeId}>
                    <span>{t.name}</span>
                    <span className="recap__count">{pluralize(t.count, 'uso', 'usos')}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="recap__facts">
            <div>
              <span className="recap__fact-value">{recap.activeDays}</span>
              <span className="recap__fact-label">{recap.activeDays === 1 ? 'dia perfumado' : 'dias perfumados'}</span>
            </div>
            <div>
              <span className="recap__fact-value">{recap.distinctPerfumes}</span>
              <span className="recap__fact-label">{recap.distinctPerfumes === 1 ? 'perfume diferente' : 'perfumes diferentes'}</span>
            </div>
            <div>
              <span className="recap__fact-value">
                {diff > 0 ? `+${diff}` : diff}
              </span>
              <span className="recap__fact-label">vs. semana anterior ({recap.previousTotal})</span>
            </div>
          </div>
          {(recap.topOccasion || recap.topFamily || recap.bestRated) && (
            <ul className="recap__extras">
              {recap.topOccasion && (
                <li>
                  Ocasião mais frequente: <strong>{recap.topOccasion.label}</strong>
                </li>
              )}
              {recap.topFamily && (
                <li>
                  Família mais usada: <strong>{recap.topFamily.name}</strong>
                </li>
              )}
              {recap.bestRated && (
                <li>
                  Melhor avaliação: <strong>{recap.bestRated.name}</strong> ({recap.bestRated.rating}/5)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

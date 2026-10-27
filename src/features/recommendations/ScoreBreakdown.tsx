import { Check, CircleDashed, Minus, X, HelpCircle, RefreshCcw } from 'lucide-react';
import type { CriterionStatus, Recommendation } from '../../services/recommendations/engine';
import { percent } from '../../utils/format';

const STATUS_META: Record<CriterionStatus, { label: string; icon: typeof Check }> = {
  match: { label: 'Combina', icon: Check },
  partial: { label: 'Parcial', icon: Minus },
  mismatch: { label: 'Não combina', icon: X },
  unknown: { label: 'Sem dados', icon: HelpCircle },
  not_applicable: { label: 'Não considerado', icon: CircleDashed },
};

export const CONFIDENCE_LABEL = { high: 'Confiança alta', medium: 'Confiança média', low: 'Confiança baixa' } as const;

/** Explica, critério a critério, como a pontuação foi calculada. */
export function ScoreBreakdown({ rec }: { rec: Recommendation }) {
  return (
    <div className="breakdown">
      <ul className="breakdown__list">
        {rec.criteria.map((c) => {
          const meta = STATUS_META[c.status];
          const Icon = meta.icon;
          const evaluated = c.status !== 'unknown' && c.status !== 'not_applicable';
          return (
            <li key={c.key} className={`breakdown__item breakdown__item--${c.status}`}>
              <div className="breakdown__head">
                <span className="breakdown__status">
                  <Icon size={14} aria-hidden />
                  {c.label}
                </span>
                <span className="breakdown__points">
                  {evaluated ? `${c.points.toFixed(1)} / ${c.weight.toFixed(0)} pts` : `— / ${c.weight.toFixed(0)} pts`}
                </span>
              </div>
              <div className="breakdown__bar" aria-hidden>
                <span style={{ width: evaluated ? `${(c.ratio ?? 0) * 100}%` : 0 }} />
              </div>
              <p className="breakdown__tag">{meta.label}</p>
              <ul className="breakdown__reasons">
                {c.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {rec.adjustments.length > 0 && (
        <ul className="breakdown__adjustments">
          {rec.adjustments.map((a) => (
            <li key={a.label} className={a.points < 0 ? 'is-negative' : 'is-positive'}>
              <span className="breakdown__status">
                <RefreshCcw size={14} aria-hidden />
                {a.label}
              </span>
              <span className="breakdown__points">
                {a.points > 0 ? '+' : ''}
                {a.points} pts
              </span>
              <p className="breakdown__reasons">{a.reason}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="breakdown__summary">
        {rec.pointsEvaluated > 0 ? (
          <>
            Obteve {rec.pointsEarned.toFixed(1)} de {rec.pointsEvaluated.toFixed(0)} pontos avaliáveis
            {rec.adjustments.length > 0 ? ` (${rec.baseScore}/100) e ajuste de rodízio` : ''} →{' '}
            <strong>{rec.score}/100</strong>. {CONFIDENCE_LABEL[rec.confidenceLevel]} ({percent(rec.confidence)} de
            certeza sobre os critérios aplicáveis).
          </>
        ) : (
          <>Nenhum critério pôde ser avaliado com os dados disponíveis.</>
        )}
      </p>
      <p className="breakdown__disclaimer">
        Pontuação heurística baseada nas suas próprias informações e nos pesos configurados — não é uma avaliação
        científica.
      </p>
    </div>
  );
}

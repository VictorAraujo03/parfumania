import { Star } from 'lucide-react';
import type { Scale } from '../types';

interface ScaleInputProps {
  label: string;
  value: Scale | undefined;
  onChange(v: Scale | undefined): void;
  labels: readonly string[];
}

/** Escala de 1 a 5 com rótulos; clicar no valor atual limpa o campo. */
export function ScaleInput({ label, value, onChange, labels }: ScaleInputProps) {
  return (
    <div className="field">
      <span className="field__label">
        {label}
        <span className="field__optional">opcional</span>
      </span>
      <div className="scale" role="radiogroup" aria-label={label}>
        {([1, 2, 3, 4, 5] as Scale[]).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} – ${labels[n - 1]}`}
            className={`scale__step ${value !== undefined && n <= value ? 'is-filled' : ''}`}
            onClick={() => onChange(value === n ? undefined : n)}
          />
        ))}
      </div>
      <p className="field__hint">{value ? labels[value - 1] : 'Não informado'}</p>
    </div>
  );
}

export function RatingInput({
  value,
  onChange,
  label = 'Avaliação',
}: {
  value: Scale | undefined;
  onChange(v: Scale | undefined): void;
  label?: string;
}) {
  return (
    <div className="rating-input" role="radiogroup" aria-label={label}>
      {([1, 2, 3, 4, 5] as Scale[]).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          className={`rating-input__star ${value !== undefined && n <= value ? 'is-on' : ''}`}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          <Star size={22} />
        </button>
      ))}
    </div>
  );
}

export function RatingDisplay({ value, size = 14 }: { value?: number; size?: number }) {
  if (!value) return null;
  return (
    <span className="rating-display" aria-label={`Avaliação ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'is-on' : ''} aria-hidden />
      ))}
    </span>
  );
}

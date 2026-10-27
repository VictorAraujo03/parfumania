import type { Option } from '../data/options';

interface MultiProps<T extends string> {
  options: Option<T>[];
  value: T[];
  onChange(v: NoInfer<T>[]): void;
  ariaLabel: string;
  disabledValues?: T[];
}

export function ChipMultiSelect<T extends string>({ options, value, onChange, ariaLabel, disabledValues = [] }: MultiProps<T>) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={`chip ${active ? 'chip--active' : ''}`}
            aria-pressed={active}
            disabled={disabledValues.includes(o.value)}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface SingleProps<T extends string> {
  options: Option<T>[];
  value: T | undefined;
  onChange(v: NoInfer<T> | undefined): void;
  ariaLabel: string;
  allowClear?: boolean;
  large?: boolean;
}

export function ChipSingleSelect<T extends string>({ options, value, onChange, ariaLabel, allowClear = true, large }: SingleProps<T>) {
  return (
    <div className={`chip-group ${large ? 'chip-group--large' : ''}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`chip ${active ? 'chip--active' : ''}`}
            onClick={() => onChange(active && allowClear ? undefined : o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { Option } from '../data/options';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className ?? ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {optional && <span className="field__optional">opcional</span>}
      </label>
      {children(id, hint || error ? descId : undefined)}
      {(error || hint) && (
        <p id={descId} className={error ? 'field__error' : 'field__hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

type BaseField = { label: string; hint?: string; error?: string; optional?: boolean; className?: string };

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: BaseField & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy) => (
        <input id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy} {...rest} />
      )}
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: BaseField & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy) => (
        <textarea id={id} className="input textarea" aria-invalid={!!error} aria-describedby={describedBy} {...rest} />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  error,
  optional,
  className,
  options,
  placeholder,
  ...rest
}: BaseField & SelectHTMLAttributes<HTMLSelectElement> & { options: Option<T>[]; placeholder?: string }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy) => (
        <select id={id} className="input select" aria-invalid={!!error} aria-describedby={describedBy} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Select simples sem rótulo visível (para barras de filtro). */
export function InlineSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: T | '';
  onChange(v: NoInfer<T> | ''): void;
  options: Option<T>[];
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <select
      className={`input select select--inline ${value ? 'is-active' : ''}`}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T | '')}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

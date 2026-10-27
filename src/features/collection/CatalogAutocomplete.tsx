import { useDeferredValue, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpen } from 'lucide-react';
import { CONCENTRATION_SHORT } from '../../data/options';
import { useCatalog } from '../../hooks/useCatalog';
import type { CatalogEntry } from '../../types';

interface CatalogAutocompleteProps {
  value: string;
  onChange(value: string): void;
  onSelect(entry: CatalogEntry): void;
  error?: string;
}

function variantLabel(e: CatalogEntry): string {
  return [
    e.concentration && e.concentration !== 'other' ? CONCENTRATION_SHORT[e.concentration] : e.concentrationLabel,
    e.year,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Campo "Nome" com sugestões da base de perfumes (demonstração + importada). */
export function CatalogAutocomplete({ value, onChange, onSelect, error }: CatalogAutocompleteProps) {
  const { search, meta } = useCatalog();
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number>();
  const deferred = useDeferredValue(value);

  const { results, total } = useMemo(
    () => (deferred.trim().length >= 2 ? search({ text: deferred }, 12) : { results: [], total: 0 }),
    [deferred, search],
  );
  const showList = open && results.length > 0;

  function choose(e: CatalogEntry) {
    onSelect(e);
    setOpen(false);
  }

  function onKeyDown(ev: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(results[active]);
    } else if (ev.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`field autocomplete ${error ? 'field--error' : ''}`}>
      <label htmlFor={id} className="field__label">
        Nome
      </label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={!!error}
        autoComplete="off"
        maxLength={120}
        placeholder="Comece a digitar: ex. One Million, Sauvage…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="autocomplete__list" onMouseDown={() => clearTimeout(blurTimer.current)}>
          {results.map((e, i) => {
            const notes = e.topNotes.length + e.heartNotes.length + e.baseNotes.length;
            return (
              <li
                key={e.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`autocomplete__option ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(e)}
              >
                <span className="autocomplete__name">
                  {e.name} <span className="muted">· {e.brand}</span>
                </span>
                <span className="autocomplete__meta">
                  {variantLabel(e)}
                  {notes > 0 ? <span className="autocomplete__tag">{notes} notas</span> : <span className="autocomplete__tag is-empty">sem notas</span>}
                </span>
              </li>
            );
          })}
          {total > results.length && (
            <li className="autocomplete__more" aria-hidden>
              +{total - results.length} resultados — continue digitando para refinar
            </li>
          )}
        </ul>
      )}
      {error ? (
        <p className="field__error">{error}</p>
      ) : (
        <p className="field__hint">
          <BookOpen size={12} aria-hidden className="inline-icon" />{' '}
          {meta
            ? `Sugestões da base ${meta.label} (${meta.count.toLocaleString('pt-BR')} perfumes) e do catálogo de demonstração.`
            : 'Sugestões do catálogo de demonstração. Importe uma base completa em Configurações → Base de perfumes.'}
        </p>
      )}
    </div>
  );
}

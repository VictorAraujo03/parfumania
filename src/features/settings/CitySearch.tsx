import { useState, type FormEvent } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { weatherProvider } from '../../services/weather';
import type { City } from '../../types';

export function CitySearch({ disabled }: { disabled?: boolean }) {
  const { settings, updateSettings } = useAppData();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<City[]>();
  const [loading, setLoading] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      setResults(await weatherProvider.searchCity(query));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha na busca.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const label = (c: City) => [c.name, c.admin1, c.country].filter(Boolean).join(', ');

  return (
    <div className="stack">
      {settings.city ? (
        <div className="city-current">
          <MapPin size={16} aria-hidden />
          <span>{label(settings.city)}</span>
          <Button size="sm" variant="ghost" icon={X} onClick={() => void updateSettings({ city: undefined })}>
            Remover
          </Button>
        </div>
      ) : (
        <p className="muted small">Nenhuma cidade definida.</p>
      )}
      <form className="inline-form" onSubmit={search}>
        <input
          className="input"
          placeholder="Buscar cidade (ex.: Belo Horizonte)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          aria-label="Buscar cidade"
        />
        <Button type="submit" icon={Search} disabled={disabled || loading || query.trim().length < 2}>
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>
      {results && (
        <ul className="city-results">
          {results.length === 0 && <li className="muted small">Nenhuma cidade encontrada.</li>}
          {results.map((c) => (
            <li key={`${c.latitude},${c.longitude}`}>
              <button
                type="button"
                onClick={async () => {
                  await updateSettings({ city: c });
                  setResults(undefined);
                  setQuery('');
                  notify(`Cidade definida: ${c.name}.`);
                }}
              >
                <MapPin size={14} aria-hidden /> {label(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="field__hint">
        A busca usa o serviço de geocodificação do Open-Meteo. Salvamos apenas o nome e as coordenadas do centro da
        cidade — nunca a sua posição exata.
      </p>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, Droplets, LocateFixed, MapPin, PencilLine, RefreshCw, Thermometer, Umbrella } from 'lucide-react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { useWeather } from '../../hooks/useWeather';
import { formatTemperature } from '../../utils/format';
import { ManualWeatherDialog } from './ManualWeatherDialog';

/** Mostra as condições atuais sem nunca inventar dados. */
export function WeatherWidget({ compact }: { compact?: boolean }) {
  const weather = useWeather();
  const { settings } = useAppData();
  const { notify } = useToast();
  const [manualOpen, setManualOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const unit = settings.temperatureUnit;

  async function locate() {
    setLocating(true);
    try {
      await weather.enableAutoLocation();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao obter localização.', 'error');
    } finally {
      setLocating(false);
    }
  }

  const s = weather.snapshot;
  const manualButton = (
    <Button size="sm" variant="ghost" icon={PencilLine} onClick={() => setManualOpen(true)}>
      {weather.manual ? 'Editar' : 'Informar manualmente'}
    </Button>
  );

  let content;
  if (s) {
    content = (
      <>
        <div className="weather__main">
          <span className="weather__temp">{formatTemperature(s.temperatureC, unit)}</span>
          <div>
            <p className="weather__desc">{s.description ?? 'Condições atuais'}</p>
            <p className="weather__loc">
              <MapPin size={12} aria-hidden /> {s.source === 'manual' ? 'Informado por você' : s.locationName}
            </p>
          </div>
        </div>
        <div className="weather__details">
          {s.apparentTemperatureC !== undefined && (
            <span title="Sensação térmica">
              <Thermometer size={14} aria-hidden /> Sensação {formatTemperature(s.apparentTemperatureC, unit)}
            </span>
          )}
          {s.humidity !== undefined && (
            <span>
              <Droplets size={14} aria-hidden /> {s.humidity}%
            </span>
          )}
          {s.precipitationProbability !== undefined && (
            <span>
              <Umbrella size={14} aria-hidden /> {s.precipitationProbability}% de chuva
            </span>
          )}
        </div>
        {!compact && weather.data?.forecast.length && s.source === 'api' ? (
          <div className="weather__forecast">
            {weather.data.forecast.slice(0, 3).map((d, i) => (
              <span key={d.date} className={i === 0 ? 'weather__today' : undefined}>
                {['Hoje', 'Amanhã', 'Depois'][i]}: {formatTemperature(d.minC, unit)} – {formatTemperature(d.maxC, unit)}
                {d.precipitationProbability !== undefined && ` · ${d.precipitationProbability}% chuva`}
              </span>
            ))}
          </div>
        ) : null}
        <div className="weather__actions">
          {weather.manual ? <Badge tone="gold">Manual</Badge> : <Badge>Fonte: {s.provider}</Badge>}
          {manualButton}
          {!weather.manual && (
            <Button size="sm" variant="ghost" iconOnly icon={RefreshCw} aria-label="Atualizar clima" onClick={weather.refresh} />
          )}
        </div>
      </>
    );
  } else if (weather.status === 'loading' || weather.geoState === 'locating') {
    content = (
      <div className="weather__loading" aria-busy="true">
        {weather.geoState === 'locating' ? 'Detectando sua localização…' : `Consultando o clima de ${weather.locationLabel}…`}
      </div>
    );
  } else {
    const message =
      weather.geoState === 'denied'
        ? 'A permissão de localização está bloqueada neste navegador. Libere no ícone de cadeado ao lado do endereço do site ou defina uma cidade.'
        : weather.status === 'no_location'
          ? 'Use sua localização para ver o clima e receber a recomendação ideal para o dia. O app lembra sua escolha.'
          : weather.status === 'disabled'
            ? 'A integração meteorológica está desativada.'
            : `Clima indisponível: ${weather.error ?? 'erro desconhecido'}`;
    content = (
      <div className="weather__empty">
        <CloudOff size={22} strokeWidth={1.4} aria-hidden />
        <p>{message}</p>
        <div className="weather__actions">
          {weather.status === 'no_location' && weather.geoState !== 'denied' && (
            <Button size="sm" variant="primary" icon={LocateFixed} onClick={locate} disabled={locating}>
              {locating ? 'Localizando…' : 'Usar minha localização'}
            </Button>
          )}
          {manualButton}
          {weather.status === 'no_location' && (
            <>
              <Link to="/configuracoes" className="btn btn--ghost btn--sm">
                Definir cidade
              </Link>
            </>
          )}
          {weather.status === 'error' && (
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={weather.refresh}>
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`weather ${compact ? 'weather--compact' : ''}`}>
      {content}
      <ManualWeatherDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

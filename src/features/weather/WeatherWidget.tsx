import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSun,
  Droplets,
  LocateFixed,
  MapPin,
  Moon,
  PencilLine,
  RefreshCw,
  Snowflake,
  Sun,
  Thermometer,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { useWeather, type LocationMode } from '../../hooks/useWeather';
import { formatTemperature } from '../../utils/format';
import { ManualWeatherDialog } from './ManualWeatherDialog';
import { WeatherScene } from './WeatherScene';
import { kindFromCode, sceneOf, sceneTip, type WeatherSceneKind } from './scene';

const KIND_ICON: Record<WeatherSceneKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
};

function iconFor(kind: WeatherSceneKind, night: boolean): LucideIcon {
  if (night && kind === 'clear') return Moon;
  if (night && kind === 'partly') return CloudMoon;
  return KIND_ICON[kind];
}

/**
 * Mostra as condições atuais sem nunca inventar dados, sobre um céu animado
 * que acompanha o tempo (sol, chuva, neblina, noite, calor seco…).
 */
export function WeatherWidget({ compact, title }: { compact?: boolean; title?: string }) {
  const weather = useWeather();
  const { settings } = useAppData();
  const { notify } = useToast();
  const [manualOpen, setManualOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const unit = settings.temperatureUnit;

  async function run(action: () => Promise<void>) {
    setLocating(true);
    try {
      await action();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao obter localização.', 'error');
    } finally {
      setLocating(false);
    }
  }
  const choose = (mode: LocationMode) => run(() => weather.setLocationMode(mode));
  const locateOnce = () => run(() => weather.useBrowserLocation());
  // Modo "perguntar sempre": oferece a localização a cada abertura, até a pessoa responder.
  const offerAsk = weather.locationMode === 'ask' && !weather.usingBrowserLocation && !weather.askDismissed;

  const s = weather.snapshot;
  const scene = useMemo(
    () => (s ? sceneOf(s, settings.climateThresholds) : undefined),
    [s, settings.climateThresholds],
  );
  const tip = scene && !compact ? sceneTip(scene) : undefined;
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
            {scene?.summary && <p className="weather__feel">{scene.summary}</p>}
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
            {weather.data.forecast.slice(0, 3).map((d, i) => {
              const DayIcon = d.weatherCode !== undefined ? iconFor(kindFromCode(d.weatherCode), false) : null;
              return (
                <span key={d.date} className={i === 0 ? 'weather__today' : undefined}>
                  {DayIcon && <DayIcon size={15} aria-hidden />}
                  <span className="weather__day">{['Hoje', 'Amanhã', 'Depois'][i]}</span>
                  {d.description && <span className="visually-hidden">{d.description}, </span>}
                  {formatTemperature(d.minC, unit)} – {formatTemperature(d.maxC, unit)}
                  {d.precipitationProbability !== undefined && ` · ${d.precipitationProbability}% chuva`}
                </span>
              );
            })}
          </div>
        ) : null}
        {tip && <p className="weather__tip">{tip}</p>}
        {offerAsk && !weather.manual && (
          <div className="weather__ask">
            <span>Usar sua localização atual?</span>
            <Button size="sm" variant="secondary" icon={LocateFixed} onClick={locateOnce} disabled={locating}>
              {locating ? 'Localizando…' : 'Usar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={weather.dismissAsk}>
              Agora não
            </Button>
          </div>
        )}
        {/* Canto inferior direito: atualizar (ou editar, se o clima foi informado à mão). */}
        <div className="weather__corner">
          {weather.manual ? (
            <Button size="sm" variant="ghost" iconOnly icon={PencilLine} aria-label="Editar clima informado" onClick={() => setManualOpen(true)} />
          ) : (
            <Button size="sm" variant="ghost" iconOnly icon={RefreshCw} aria-label={`Atualizar clima (fonte: ${s.provider})`} title={`Fonte: ${s.provider}`} onClick={weather.refresh} />
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
  } else if (weather.status === 'no_location' && weather.geoState !== 'denied' && (!weather.locationMode || offerAsk)) {
    // Pergunta como nos apps nativos — a escolha fica salva neste aparelho.
    const first = !weather.locationMode;
    content = (
      <div className="weather__permission">
        <LocateFixed size={24} strokeWidth={1.4} aria-hidden />
        <p className="weather__permission-title">
          {first ? 'Permitir que o Parfumania use sua localização?' : 'Usar sua localização agora?'}
        </p>
        <p className="weather__permission-text">
          {first
            ? 'Para mostrar o clima de onde você está e recomendar o perfume ideal para o dia. Usamos só a posição aproximada (~1 km).'
            : 'Você escolheu que o app pergunte sempre.'}
        </p>
        <div className="weather__permission-actions">
          {first ? (
            <>
              <Button variant="primary" onClick={() => choose('always')} disabled={locating}>
                {locating ? 'Localizando…' : 'Permitir sempre'}
              </Button>
              <Button variant="secondary" onClick={() => choose('ask')} disabled={locating}>
                Perguntar sempre
              </Button>
              <Button variant="ghost" onClick={() => choose('never')} disabled={locating}>
                Não permitir
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" icon={LocateFixed} onClick={locateOnce} disabled={locating}>
                {locating ? 'Localizando…' : 'Usar agora'}
              </Button>
              <Button variant="ghost" onClick={weather.dismissAsk}>
                Agora não
              </Button>
            </>
          )}
        </div>
        {first && (
          <p className="weather__permission-hint">
            “Permitir sempre” guarda a posição aproximada neste aparelho por até 3 horas, para não perguntar a cada
            abertura. Dá para mudar em Configurações.
          </p>
        )}
      </div>
    );
  } else {
    const message =
      weather.geoState === 'denied'
        ? 'A localização está bloqueada para este site. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › “Durante o Uso”. No computador: ícone de cadeado ao lado do endereço. Ou defina uma cidade.'
        : weather.status === 'no_location'
          ? weather.locationMode === 'never'
            ? 'Localização desativada neste aparelho. Defina uma cidade ou informe o clima.'
            : 'Sem localização no momento. Defina uma cidade, informe o clima ou use sua localização.'
          : weather.status === 'disabled'
            ? 'A integração meteorológica está desativada.'
            : `Clima indisponível: ${weather.error ?? 'erro desconhecido'}`;
    content = (
      <div className="weather__empty">
        <CloudOff size={22} strokeWidth={1.4} aria-hidden />
        <p>{message}</p>
        <div className="weather__actions">
          {weather.status === 'no_location' && weather.geoState !== 'denied' && weather.locationMode !== 'never' && (
            <Button size="sm" variant="primary" icon={LocateFixed} onClick={locateOnce} disabled={locating}>
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
    <div className={`weather ${compact ? 'weather--compact' : ''} ${scene ? 'weather--sky' : ''}`}>
      {scene && <WeatherScene scene={scene} />}
      <div className="weather__body">
        {title && (
          <h2 className="card__title weather__title">
            {scene && (() => {
              const Icon = iconFor(scene.kind, scene.night);
              return <Icon size={16} aria-hidden />;
            })()}
            {title}
          </h2>
        )}
        {content}
      </div>
      <ManualWeatherDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

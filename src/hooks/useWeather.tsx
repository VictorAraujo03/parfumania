import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WEATHER_INTEGRATION_ENABLED, weatherProvider, type Coordinates } from '../services/weather';
import { reverseGeocode } from '../services/weather/reverseGeocode';
import type { WeatherData, WeatherSnapshot } from '../types';
import { useAppData } from './useAppData';

export type WeatherStatus = 'disabled' | 'no_location' | 'loading' | 'ready' | 'error';

/** Estado da geolocalização do navegador. */
export type GeoState = 'idle' | 'locating' | 'denied' | 'unavailable';

interface WeatherValue {
  status: WeatherStatus;
  data?: WeatherData;
  error?: string;
  /** Condições informadas manualmente (têm prioridade sobre a API). */
  manual?: WeatherSnapshot;
  /** Condições efetivas: manual ou da API. Nunca inventadas. */
  snapshot?: WeatherSnapshot;
  locationLabel?: string;
  usingBrowserLocation: boolean;
  geoState: GeoState;
  /** Escolha feita NESTE aparelho; undefined = ainda não perguntamos. */
  locationMode?: LocationMode;
  /** Modo "perguntar sempre": true depois de "Agora não" nesta abertura do app. */
  askDismissed: boolean;
  refresh(): void;
  /** Pede a localização uma vez (permissão do navegador). */
  useBrowserLocation(): Promise<void>;
  /** Salva a escolha (permitir sempre / perguntar sempre / não permitir) e age conforme ela. */
  setLocationMode(mode: LocationMode): Promise<void>;
  /** "Agora não" no modo perguntar sempre. */
  dismissAsk(): void;
  setManual(snapshot: WeatherSnapshot | undefined): void;
}

/**
 * Como o app usa a localização deste aparelho, como nos apps nativos:
 * - always: usa sozinho; a posição aproximada fica guardada aqui por até 3 h,
 *   para não pedir de novo a cada abertura;
 * - ask: pergunta (dentro do app) a cada abertura;
 * - never: nunca pede; usa a cidade salva ou o clima informado à mão.
 */
export type LocationMode = 'always' | 'ask' | 'never';

const WeatherContext = createContext<WeatherValue | null>(null);
const CACHE_KEY = 'parfumania.weatherCache';
const MANUAL_KEY = 'parfumania.manualWeather';
const CACHE_MS = 20 * 60 * 1000;
const MODE_KEY = 'parfumania.locationMode';
const ASK_DISMISSED_KEY = 'parfumania.locationAskDismissed';
const LAST_LOCATION_KEY = 'parfumania.lastLocation';
/** Por quanto tempo a localização aproximada é reaproveitada no modo "permitir sempre". */
const LAST_LOCATION_MS = 3 * 60 * 60 * 1000;

function readLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento: vale só para esta sessão */
  }
}

interface Location {
  coords: Coordinates;
  name: string;
  fromBrowser: boolean;
}

function readSession<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeSession(key: string, value: unknown) {
  try {
    if (value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sessionStorage indisponível: segue sem cache */
  }
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { settings, status: dataStatus, updateSettings } = useAppData();
  const [browserLocation, setBrowserLocation] = useState<Location>();
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const autoTried = useRef(false);
  // Quem tinha a antiga "detectar ao abrir" ligada começa em "permitir sempre".
  const [locationMode, setModeState] = useState<LocationMode | undefined>(
    () => readLocal<LocationMode>(MODE_KEY) ?? (settings.autoLocation ? 'always' : undefined),
  );
  const [askDismissed, setAskDismissed] = useState(() => readSession<boolean>(ASK_DISMISSED_KEY) === true);
  const [data, setData] = useState<WeatherData>();
  const [status, setStatus] = useState<WeatherStatus>('loading');
  const [error, setError] = useState<string>();
  const [manual, setManualState] = useState<WeatherSnapshot | undefined>(() => readSession(MANUAL_KEY));
  const [nonce, setNonce] = useState(0);

  const enabled = WEATHER_INTEGRATION_ENABLED && settings.weatherEnabled;

  // A localização do navegador (sessão atual) tem prioridade sobre a cidade salva.
  const location: Location | undefined = useMemo(() => {
    if (browserLocation) return browserLocation;
    if (!settings.city) return undefined;
    const c = settings.city;
    return {
      coords: { latitude: c.latitude, longitude: c.longitude },
      name: [c.name, c.admin1].filter(Boolean).join(', '),
      fromBrowser: false,
    };
  }, [browserLocation, settings.city]);

  useEffect(() => {
    if (dataStatus !== 'ready') return;
    if (!enabled) {
      setStatus('disabled');
      return;
    }
    if (!location) {
      setStatus('no_location');
      return;
    }
    const cacheId = `${location.coords.latitude},${location.coords.longitude}`;
    const cached = readSession<{ id: string; data: WeatherData }>(CACHE_KEY);
    if (nonce === 0 && cached?.id === cacheId && Date.now() - Date.parse(cached.data.fetchedAt) < CACHE_MS) {
      setData({ ...cached.data, locationName: location.name });
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(undefined);
    weatherProvider
      .getCurrent(location.coords, location.name)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus('ready');
        writeSession(CACHE_KEY, { id: cacheId, data: d });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(undefined);
        setError(err instanceof Error ? err.message : 'Falha ao obter o clima.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [dataStatus, enabled, location, nonce]);

  const modeRef = useRef(locationMode);
  modeRef.current = locationMode;

  // As configurações da conta chegam depois da montagem: migra a antiga "detectar ao abrir".
  useEffect(() => {
    if (dataStatus === 'ready' && !locationMode && settings.autoLocation) setModeState('always');
  }, [dataStatus, locationMode, settings.autoLocation]);

  const useBrowserLocation = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          setGeoState('unavailable');
          reject(new Error('Seu navegador não oferece geolocalização.'));
          return;
        }
        setGeoState('locating');
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            // Arredondada (~1 km). Só fica guardada neste aparelho (por até 3 h) no modo "permitir sempre".
            const coords = {
              latitude: Math.round(pos.coords.latitude * 100) / 100,
              longitude: Math.round(pos.coords.longitude * 100) / 100,
            };
            const name = (await reverseGeocode(coords)) ?? 'Sua localização atual';
            setBrowserLocation({ coords, name, fromBrowser: true });
            if (modeRef.current === 'always') writeLocal(LAST_LOCATION_KEY, { coords, name, at: Date.now() });
            setGeoState('idle');
            resolve();
          },
          (err) => {
            const denied = err.code === err.PERMISSION_DENIED;
            setGeoState(denied ? 'denied' : 'unavailable');
            reject(
              new Error(
                denied
                  ? 'A localização está bloqueada para este site nos ajustes do aparelho ou do navegador.'
                  : 'Não foi possível obter sua localização.',
              ),
            );
          },
          { maximumAge: 10 * 60 * 1000, timeout: 15000 },
        );
      }),
    [],
  );

  const setLocationMode = useCallback(
    async (mode: LocationMode) => {
      setModeState(mode);
      modeRef.current = mode;
      writeLocal(MODE_KEY, mode);
      if (mode !== 'always') writeLocal(LAST_LOCATION_KEY, undefined);
      // Mantém a preferência antiga da conta coerente (usada só para migrar outros aparelhos).
      if (settings.autoLocation !== (mode === 'always')) void updateSettings({ autoLocation: mode === 'always' }).catch(() => undefined);
      if (mode === 'never') {
        setBrowserLocation(undefined);
        setGeoState('idle');
        return;
      }
      await useBrowserLocation();
    },
    [settings.autoLocation, updateSettings, useBrowserLocation],
  );

  const dismissAsk = useCallback(() => {
    setAskDismissed(true);
    writeSession(ASK_DISMISSED_KEY, true);
  }, []);

  // "Permitir sempre": ao abrir, reaproveita a localização recente sem acionar o
  // aviso do sistema; se ela tiver mais de 3 h, consulta de novo.
  useEffect(() => {
    if (dataStatus !== 'ready' || locationMode !== 'always' || !enabled || browserLocation || autoTried.current) return;
    autoTried.current = true;
    const last = readLocal<{ coords: Coordinates; name: string; at: number }>(LAST_LOCATION_KEY);
    if (last && Date.now() - last.at < LAST_LOCATION_MS) {
      setBrowserLocation({ coords: last.coords, name: last.name, fromBrowser: true });
      return;
    }
    const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
    const ask = () => useBrowserLocation().catch(() => undefined);
    if (!permissions?.query) {
      void ask();
      return;
    }
    permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => (p.state === 'denied' ? setGeoState('denied') : void ask()))
      .catch(() => void ask());
  }, [dataStatus, locationMode, enabled, browserLocation, useBrowserLocation]);

  const setManual = useCallback((s: WeatherSnapshot | undefined) => {
    setManualState(s);
    writeSession(MANUAL_KEY, s);
  }, []);

  const apiSnapshot: WeatherSnapshot | undefined = useMemo(
    () =>
      data && status === 'ready'
        ? {
            temperatureC: data.temperatureC,
            apparentTemperatureC: data.apparentTemperatureC,
            humidity: data.humidity,
            precipitationProbability: data.precipitationProbability,
            description: data.description,
            weatherCode: data.weatherCode,
            isDay: data.isDay,
            source: 'api',
            provider: data.provider,
            locationName: data.locationName,
            observedAt: data.fetchedAt,
          }
        : undefined,
    [data, status],
  );

  const value = useMemo<WeatherValue>(
    () => ({
      status,
      data: status === 'ready' ? data : undefined,
      error,
      manual,
      snapshot: manual ?? apiSnapshot,
      locationLabel: location?.name,
      usingBrowserLocation: !!browserLocation,
      geoState,
      locationMode,
      askDismissed,
      refresh: () => setNonce((n) => n + 1),
      useBrowserLocation,
      setLocationMode,
      dismissAsk,
      setManual,
    }),
    [status, data, error, manual, apiSnapshot, location, browserLocation, geoState, locationMode, askDismissed, useBrowserLocation, setLocationMode, dismissAsk, setManual],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather deve ser usado dentro de WeatherProvider.');
  return ctx;
}

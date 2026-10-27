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
  /** Preferência salva na conta: detectar a localização ao abrir o app. */
  autoLocation: boolean;
  refresh(): void;
  /** Pede a localização uma vez (permissão do navegador). */
  useBrowserLocation(): Promise<void>;
  /** Liga a detecção automática (salva na conta) e já pede a localização. */
  enableAutoLocation(): Promise<void>;
  setManual(snapshot: WeatherSnapshot | undefined): void;
}

const WeatherContext = createContext<WeatherValue | null>(null);
const CACHE_KEY = 'parfumania.weatherCache';
const MANUAL_KEY = 'parfumania.manualWeather';
const CACHE_MS = 20 * 60 * 1000;

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
            // Arredondada (~1 km) e mantida apenas em memória: nunca é salva.
            const coords = {
              latitude: Math.round(pos.coords.latitude * 100) / 100,
              longitude: Math.round(pos.coords.longitude * 100) / 100,
            };
            const name = (await reverseGeocode(coords)) ?? 'Sua localização atual';
            setBrowserLocation({ coords, name, fromBrowser: true });
            setGeoState('idle');
            resolve();
          },
          (err) => {
            const denied = err.code === err.PERMISSION_DENIED;
            setGeoState(denied ? 'denied' : 'unavailable');
            reject(
              new Error(
                denied
                  ? 'Permissão de localização negada. Libere no ícone de cadeado ao lado do endereço do site.'
                  : 'Não foi possível obter sua localização.',
              ),
            );
          },
          { maximumAge: 10 * 60 * 1000, timeout: 15000 },
        );
      }),
    [],
  );

  const enableAutoLocation = useCallback(async () => {
    if (!settings.autoLocation) await updateSettings({ autoLocation: true });
    await useBrowserLocation();
  }, [settings.autoLocation, updateSettings, useBrowserLocation]);

  // Detecção automática ao abrir o app, se você ativou essa opção.
  useEffect(() => {
    if (dataStatus !== 'ready' || !settings.autoLocation || !enabled || browserLocation || autoTried.current) return;
    autoTried.current = true;
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
  }, [dataStatus, settings.autoLocation, enabled, browserLocation, useBrowserLocation]);

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
      autoLocation: settings.autoLocation,
      refresh: () => setNonce((n) => n + 1),
      useBrowserLocation,
      enableAutoLocation,
      setManual,
    }),
    [status, data, error, manual, apiSnapshot, location, browserLocation, geoState, settings.autoLocation, useBrowserLocation, enableAutoLocation, setManual],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather deve ser usado dentro de WeatherProvider.');
  return ctx;
}

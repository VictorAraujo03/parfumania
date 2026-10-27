import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { WEATHER_INTEGRATION_ENABLED, weatherProvider, type Coordinates } from '../services/weather';
import type { WeatherData, WeatherSnapshot } from '../types';
import { useAppData } from './useAppData';

export type WeatherStatus = 'disabled' | 'no_location' | 'loading' | 'ready' | 'error';

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
  refresh(): void;
  useBrowserLocation(): Promise<void>;
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
  const { settings, status: dataStatus } = useAppData();
  const [browserLocation, setBrowserLocation] = useState<Location>();
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
          reject(new Error('Seu navegador não oferece geolocalização.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Mantida apenas em memória nesta sessão e arredondada (~1 km).
            setBrowserLocation({
              coords: {
                latitude: Math.round(pos.coords.latitude * 100) / 100,
                longitude: Math.round(pos.coords.longitude * 100) / 100,
              },
              name: 'Sua localização atual',
              fromBrowser: true,
            });
            resolve();
          },
          (err) =>
            reject(
              new Error(
                err.code === err.PERMISSION_DENIED
                  ? 'Permissão de localização negada.'
                  : 'Não foi possível obter sua localização.',
              ),
            ),
          { maximumAge: 10 * 60 * 1000, timeout: 15000 },
        );
      }),
    [],
  );

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
      refresh: () => setNonce((n) => n + 1),
      useBrowserLocation,
      setManual,
    }),
    [status, data, error, manual, apiSnapshot, location, browserLocation, useBrowserLocation, setManual],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather deve ser usado dentro de WeatherProvider.');
  return ctx;
}

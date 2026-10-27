import type { City, WeatherData } from '../../types';
import { WeatherError, type Coordinates, type WeatherProvider } from './types';
import { describeWeatherCode } from './weatherCodes';

/**
 * Open-Meteo (https://open-meteo.com): API gratuita, sem chave e com CORS,
 * adequada para uso direto no navegador em projetos não comerciais.
 * Verifique os termos de uso antes de um uso comercial.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  hourly?: { time: string[]; precipitation_probability?: (number | null)[] };
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
    weather_code?: number[];
  };
}

interface GeocodingResponse {
  results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new WeatherError(`O serviço meteorológico respondeu com erro (${res.status}).`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof WeatherError) throw err;
    throw new WeatherError('Não foi possível conectar ao serviço meteorológico.');
  } finally {
    clearTimeout(timer);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const orUndef = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v);

export const openMeteoProvider: WeatherProvider = {
  id: 'open-meteo',
  name: 'Open-Meteo',

  async getCurrent(coords: Coordinates, locationName: string): Promise<WeatherData> {
    // Coordenadas arredondadas (~1 km): suficiente para o clima, sem precisão desnecessária.
    const params = new URLSearchParams({
      latitude: String(round2(coords.latitude)),
      longitude: String(round2(coords.longitude)),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
      hourly: 'precipitation_probability',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      timezone: 'auto',
      forecast_days: '3',
    });
    const data = await getJson<ForecastResponse>(`${FORECAST_URL}?${params}`);
    if (!data.current) throw new WeatherError('Resposta meteorológica sem dados atuais.');

    const hourPrefix = data.current.time.slice(0, 13);
    const hourIdx = data.hourly?.time.findIndex((t) => t.startsWith(hourPrefix)) ?? -1;
    const precip = hourIdx >= 0 ? orUndef(data.hourly?.precipitation_probability?.[hourIdx]) : undefined;

    return {
      temperatureC: data.current.temperature_2m,
      apparentTemperatureC: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      precipitationProbability: precip,
      description: describeWeatherCode(data.current.weather_code),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === undefined ? undefined : data.current.is_day === 1,
      forecast: (data.daily?.time ?? []).map((date, i) => ({
        date,
        minC: data.daily?.temperature_2m_min?.[i],
        maxC: data.daily?.temperature_2m_max?.[i],
        precipitationProbability: orUndef(data.daily?.precipitation_probability_max?.[i]),
        description: describeWeatherCode(data.daily?.weather_code?.[i]),
        weatherCode: orUndef(data.daily?.weather_code?.[i]),
      })),
      provider: 'Open-Meteo',
      locationName,
      fetchedAt: new Date().toISOString(),
    };
  },

  async searchCity(query: string): Promise<City[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const params = new URLSearchParams({ name: q, count: '6', language: 'pt', format: 'json' });
    const data = await getJson<GeocodingResponse>(`${GEOCODING_URL}?${params}`);
    return (data.results ?? []).map((r) => ({
      name: r.name,
      admin1: r.admin1,
      country: r.country,
      latitude: round2(r.latitude),
      longitude: round2(r.longitude),
    }));
  },
};

import { openMeteoProvider } from './openMeteo';
import type { WeatherProvider } from './types';

export * from './types';

/** Integração habilitada por padrão; desative com VITE_WEATHER_ENABLED=false. */
export const WEATHER_INTEGRATION_ENABLED = import.meta.env.VITE_WEATHER_ENABLED !== 'false';

/** Ponto único de troca do provedor meteorológico. */
export const weatherProvider: WeatherProvider = openMeteoProvider;

export interface City {
  name: string;
  admin1?: string;
  country?: string;
  /** Coordenadas da cidade (centro), não da posição do usuário. */
  latitude: number;
  longitude: number;
}

export interface WeatherForecastDay {
  date: string;
  minC?: number;
  maxC?: number;
  precipitationProbability?: number;
  description?: string;
  /** Código WMO da condição (céu limpo, chuva, neve…). */
  weatherCode?: number;
}

export interface WeatherData {
  temperatureC?: number;
  apparentTemperatureC?: number;
  humidity?: number;
  precipitationProbability?: number;
  description?: string;
  weatherCode?: number;
  isDay?: boolean;
  forecast: WeatherForecastDay[];
  provider: string;
  locationName: string;
  fetchedAt: string;
}

/** Condições usadas em uma recomendação ou registro de uso. */
export interface WeatherSnapshot {
  temperatureC?: number;
  apparentTemperatureC?: number;
  humidity?: number;
  precipitationProbability?: number;
  description?: string;
  weatherCode?: number;
  isDay?: boolean;
  source: 'api' | 'manual';
  provider?: string;
  locationName?: string;
  observedAt: string;
}

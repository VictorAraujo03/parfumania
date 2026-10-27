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
}

export interface WeatherData {
  temperatureC?: number;
  apparentTemperatureC?: number;
  humidity?: number;
  precipitationProbability?: number;
  description?: string;
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
  source: 'api' | 'manual';
  provider?: string;
  locationName?: string;
  observedAt: string;
}

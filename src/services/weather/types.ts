import type { City, WeatherData } from '../../types';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Contrato de um provedor meteorológico. Provedores que exigem chave secreta
 * devem ser implementados chamando uma função de servidor (ex.: /api/weather),
 * nunca com a chave embutida no frontend.
 */
export interface WeatherProvider {
  id: string;
  name: string;
  getCurrent(coords: Coordinates, locationName: string): Promise<WeatherData>;
  searchCity(query: string): Promise<City[]>;
}

export class WeatherError extends Error {}

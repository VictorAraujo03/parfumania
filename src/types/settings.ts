import type { IntensityPreference, Occasion, OlfactoryFamily } from './perfume';
import type { City } from './weather';

/** Pesos (em pontos) de cada critério do motor de recomendação. */
export interface RecommendationWeights {
  climate: number;
  occasion: number;
  environment: number;
  period: number;
  personal: number;
}

export interface ClimateThresholds {
  /** A partir desta temperatura (°C) o dia é considerado quente. */
  hotMinC: number;
  /** Abaixo desta temperatura (°C) o dia é considerado frio. */
  coldMaxC: number;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export interface Settings {
  displayName: string;
  temperatureUnit: 'C' | 'F';
  city?: City;
  weatherEnabled: boolean;
  theme: ThemePreference;
  weights: RecommendationWeights;
  climateThresholds: ClimateThresholds;
  favoriteFamilies: OlfactoryFamily[];
  dislikedFamilies: OlfactoryFamily[];
  preferredIntensity?: IntensityPreference;
  frequentOccasions: Occasion[];
  /** Orçamento para futuras compras, em BRL. */
  budget?: number;
  demoBannerDismissed: boolean;
}

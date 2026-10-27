import type { ClimateThresholds, RecommendationWeights, Settings } from '../types';

/**
 * Pesos iniciais do motor de recomendação (somam 100).
 * Documentados em docs/RECOMENDACOES.md e editáveis em Configurações.
 */
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  climate: 30,
  occasion: 25,
  environment: 20,
  period: 10,
  personal: 15,
};

export const DEFAULT_CLIMATE_THRESHOLDS: ClimateThresholds = {
  hotMinC: 26,
  coldMaxC: 16,
};

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  temperatureUnit: 'C',
  city: undefined,
  weatherEnabled: true,
  autoLocation: false,
  theme: 'dark',
  weights: DEFAULT_WEIGHTS,
  climateThresholds: DEFAULT_CLIMATE_THRESHOLDS,
  favoriteFamilies: [],
  dislikedFamilies: [],
  preferredIntensity: undefined,
  frequentOccasions: [],
  budget: undefined,
  demoBannerDismissed: false,
};

import { useMemo } from 'react';
import { recommend, type RecommendationContext, type RecommendationResult } from '../services/recommendations/engine';
import { formatTemperature } from '../utils/format';
import { useAppData } from './useAppData';

/** Conecta o motor de recomendação aos dados e configurações do usuário. */
export function useRecommendations(context: RecommendationContext): RecommendationResult {
  const { perfumes, usageLogs, settings } = useAppData();
  return useMemo(
    () =>
      recommend(perfumes, context, {
        weights: settings.weights,
        thresholds: settings.climateThresholds,
        favoriteFamilies: settings.favoriteFamilies,
        dislikedFamilies: settings.dislikedFamilies,
        preferredIntensity: settings.preferredIntensity,
        usageLogs,
        variety: settings.varietyEnabled,
        formatTemperature: (c) => formatTemperature(c, settings.temperatureUnit),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfumes, usageLogs, settings, JSON.stringify(context)],
  );
}

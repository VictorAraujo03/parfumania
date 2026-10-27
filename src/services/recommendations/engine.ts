import type {
  ClimateThresholds,
  DayPeriod,
  Environment,
  IntensityPreference,
  Occasion,
  OlfactoryFamily,
  Perfume,
  RecommendationWeights,
  UsageLog,
} from '../../types';
import {
  evaluateClimate,
  evaluateEnvironment,
  evaluateOccasion,
  evaluatePeriod,
  evaluatePersonal,
  type ContextWeather,
  type CriterionEvaluation,
} from './criteria';
import { CRITERIA, normalizeWeights, type CriterionKey } from './weights';

/**
 * Motor de recomendação baseado em regras (sem IA generativa).
 *
 * Pontuação (0–100) = soma dos pontos dos critérios AVALIADOS, reescalada
 *   pelo peso total desses critérios. Critérios sem dados do perfume não
 *   contam pontos — em vez disso reduzem a CONFIANÇA.
 * Confiança (0–1)   = peso dos critérios avaliados / peso dos critérios aplicáveis
 *   (critérios sem informação de contexto, ex.: ocasião não escolhida, ficam fora).
 * Ordenação         = pontuação × (0,5 + 0,5 × confiança) — perfumes com dados
 *   completos vencem empates contra perfumes pouco descritos.
 *
 * As pontuações são heurísticas pessoais, não avaliações científicas.
 * Detalhes em docs/RECOMENDACOES.md.
 */

export interface RecommendationContext {
  weather?: ContextWeather;
  period?: DayPeriod;
  occasion?: Occasion;
  environment?: Environment;
  intensity?: IntensityPreference;
  preferredFamily?: OlfactoryFamily;
}

export interface RecommendationOptions {
  weights: RecommendationWeights;
  thresholds: ClimateThresholds;
  favoriteFamilies: OlfactoryFamily[];
  dislikedFamilies: OlfactoryFamily[];
  preferredIntensity?: IntensityPreference;
  usageLogs: UsageLog[];
  formatTemperature?: (celsius: number) => string;
}

export type CriterionStatus = 'match' | 'partial' | 'mismatch' | 'unknown' | 'not_applicable';

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  /** Peso normalizado (pontos possíveis de 100). */
  weight: number;
  status: CriterionStatus;
  ratio?: number;
  points: number;
  reasons: string[];
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Recommendation {
  perfume: Perfume;
  score: number;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  rankScore: number;
  pointsEarned: number;
  pointsEvaluated: number;
  criteria: CriterionResult[];
  highlights: string[];
  caveats: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  excluded: { perfume: Perfume; reason: string }[];
  /** true quando nenhum perfume tem dados suficientes para uma recomendação confiável. */
  insufficientData: boolean;
  weights: RecommendationWeights;
}

const ELIGIBLE_STATUS = new Set<Perfume['status']>(['owned', 'decant']);
const MIN_CONFIDENCE = 0.34;

export function confidenceLevel(c: number): ConfidenceLevel {
  if (c >= 0.75) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

function toStatus(e: CriterionEvaluation): CriterionStatus {
  if (e.status !== 'evaluated') return e.status;
  const r = e.ratio ?? 0;
  if (r >= 0.8) return 'match';
  if (r >= 0.4) return 'partial';
  return 'mismatch';
}

export function scorePerfume(
  perfume: Perfume,
  context: RecommendationContext,
  options: RecommendationOptions,
): Recommendation {
  const weights = normalizeWeights(options.weights);
  const fmt = options.formatTemperature ?? ((c: number) => `${Math.round(c)}°C`);

  const evaluations: Record<CriterionKey, CriterionEvaluation> = {
    climate: evaluateClimate(perfume, context.weather, options.thresholds, fmt),
    occasion: evaluateOccasion(perfume, context.occasion),
    environment: evaluateEnvironment(perfume, context.environment),
    period: evaluatePeriod(perfume, context.period),
    personal: evaluatePersonal(perfume, {
      favoriteFamilies: options.favoriteFamilies,
      dislikedFamilies: options.dislikedFamilies,
      intensity: context.intensity ?? options.preferredIntensity,
      preferredFamily: context.preferredFamily,
      logs: options.usageLogs,
    }),
  };

  const criteria: CriterionResult[] = CRITERIA.map(({ key, label }) => {
    const e = evaluations[key];
    const weight = weights[key];
    return {
      key,
      label,
      weight,
      status: toStatus(e),
      ratio: e.ratio,
      points: e.status === 'evaluated' ? (e.ratio ?? 0) * weight : 0,
      reasons: e.reasons,
    };
  });

  const applicable = criteria.filter((c) => c.status !== 'not_applicable' && c.weight > 0);
  const evaluated = applicable.filter((c) => c.status !== 'unknown');
  const applicableWeight = applicable.reduce((s, c) => s + c.weight, 0);
  const evaluatedWeight = evaluated.reduce((s, c) => s + c.weight, 0);
  const pointsEarned = evaluated.reduce((s, c) => s + c.points, 0);

  const score = evaluatedWeight > 0 ? (pointsEarned / evaluatedWeight) * 100 : 0;
  const confidence = applicableWeight > 0 ? evaluatedWeight / applicableWeight : 0;

  const highlights = criteria
    .filter((c) => c.status === 'match')
    .sort((a, b) => b.points - a.points)
    .map((c) => c.reasons[0]);
  const caveats = criteria
    .filter((c) => c.status === 'unknown' || c.status === 'mismatch')
    .map((c) => c.reasons[0]);

  return {
    perfume,
    score: Math.round(score),
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    rankScore: score * (0.5 + 0.5 * confidence) * (perfume.status === 'owned' ? 1 : 0.97),
    pointsEarned,
    pointsEvaluated: evaluatedWeight,
    criteria,
    highlights,
    caveats,
  };
}

export function recommend(
  perfumes: Perfume[],
  context: RecommendationContext,
  options: RecommendationOptions,
): RecommendationResult {
  const excluded: RecommendationResult['excluded'] = [];
  const eligible = perfumes.filter((p) => {
    if (!ELIGIBLE_STATUS.has(p.status)) {
      excluded.push({ perfume: p, reason: 'Não está disponível na coleção (desejado, acabou ou vendido).' });
      return false;
    }
    if (p.remainingMl === 0) {
      excluded.push({ perfume: p, reason: 'Volume restante informado como 0 ml.' });
      return false;
    }
    return true;
  });

  const recommendations = eligible
    .map((p) => scorePerfume(p, context, options))
    .sort((a, b) => b.rankScore - a.rankScore || a.perfume.name.localeCompare(b.perfume.name));

  return {
    recommendations,
    excluded,
    insufficientData: recommendations.every((r) => r.confidence < MIN_CONFIDENCE || r.pointsEvaluated === 0),
    weights: normalizeWeights(options.weights),
  };
}

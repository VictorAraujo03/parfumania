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
import { daysBetween } from '../../utils/date';
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
 * Pontuação base (0–100) = soma dos pontos dos critérios AVALIADOS, reescalada
 *   pelo peso total desses critérios. Cada critério é gradual (0–1): considera
 *   o quanto a indicação é específica, situações parecidas, o perfil olfativo
 *   dos acordes/notas cadastrados e a força do perfume.
 * Rodízio                = ajuste de -12 a +4 pontos conforme o uso recente
 *   (evita sugerir o mesmo perfume todo dia). Pode ser desligado.
 * Confiança (0–1)        = Σ(peso × certeza) dos critérios avaliados / peso dos
 *   aplicáveis. Avaliações vindas só de heurísticas têm certeza menor que as
 *   baseadas no que você marcou.
 * Ordenação              = pontuação × (0,5 + 0,5 × confiança).
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
  /** Ajuste de rodízio conforme o uso recente (padrão: ligado). */
  variety?: boolean;
  now?: Date;
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
  certainty: number;
  points: number;
  reasons: string[];
}

export interface ScoreAdjustment {
  label: string;
  points: number;
  reason: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Recommendation {
  perfume: Perfume;
  score: number;
  /** Pontuação antes dos ajustes. */
  baseScore: number;
  adjustments: ScoreAdjustment[];
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
  if (r >= 0.45) return 'partial';
  return 'mismatch';
}

/** Ajuste de rodízio a partir dos registros de uso deste perfume. */
export function varietyAdjustment(perfume: Perfume, logs: UsageLog[], now: Date): ScoreAdjustment | undefined {
  const own = logs.filter((l) => l.perfumeId === perfume.id);
  if (own.length === 0) {
    // Só faz sentido sugerir "experimente" quando você já registra usos de outros.
    return logs.length >= 5
      ? { label: 'Rodízio', points: 3, reason: 'Ainda sem registros de uso — que tal estreá-lo?' }
      : undefined;
  }
  const last = own.reduce((m, l) => (l.usedAt > m ? l.usedAt : m), own[0].usedAt);
  const days = daysBetween(new Date(last), now);
  const lastWeek = own.filter((l) => {
    const d = daysBetween(new Date(l.usedAt), now);
    return d >= 0 && d < 7;
  }).length;

  if (days <= 0) return { label: 'Rodízio', points: -12, reason: 'Você já usou hoje.' };
  if (days === 1) return { label: 'Rodízio', points: -7, reason: 'Usado ontem — alternar evita acostumar o nariz.' };
  if (lastWeek >= 3) return { label: 'Rodízio', points: -5, reason: `Já usado ${lastWeek} vezes nos últimos 7 dias.` };
  if (days === 2) return { label: 'Rodízio', points: -3, reason: 'Usado anteontem.' };
  if (days >= 21) return { label: 'Rodízio', points: 4, reason: `Faz ${days} dias que você não usa — boa hora de revisitá-lo.` };
  return undefined;
}

export function scorePerfume(
  perfume: Perfume,
  context: RecommendationContext,
  options: RecommendationOptions,
): Recommendation {
  const weights = normalizeWeights(options.weights);
  const fmt = options.formatTemperature ?? ((c: number) => `${Math.round(c)}°C`);
  const now = options.now ?? new Date();

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
      occasion: context.occasion,
      temperatureC: context.weather?.apparentTemperatureC ?? context.weather?.temperatureC,
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
      certainty: e.status === 'evaluated' ? e.certainty ?? 1 : 0,
      points: e.status === 'evaluated' ? (e.ratio ?? 0) * weight : 0,
      reasons: e.reasons,
    };
  });

  const applicable = criteria.filter((c) => c.status !== 'not_applicable' && c.weight > 0);
  const evaluated = applicable.filter((c) => c.status !== 'unknown');
  const applicableWeight = applicable.reduce((s, c) => s + c.weight, 0);
  const evaluatedWeight = evaluated.reduce((s, c) => s + c.weight, 0);
  const certainWeight = evaluated.reduce((s, c) => s + c.weight * c.certainty, 0);
  const pointsEarned = evaluated.reduce((s, c) => s + c.points, 0);

  const baseScore = evaluatedWeight > 0 ? (pointsEarned / evaluatedWeight) * 100 : 0;
  const confidence = applicableWeight > 0 ? certainWeight / applicableWeight : 0;

  const adjustments: ScoreAdjustment[] = [];
  if (options.variety !== false && evaluatedWeight > 0) {
    const v = varietyAdjustment(perfume, options.usageLogs, now);
    if (v) adjustments.push(v);
  }
  const score = Math.max(0, Math.min(100, baseScore + adjustments.reduce((s, a) => s + a.points, 0)));

  // Destaques: o que combinou; se pouco combinou plenamente, completa com os parciais.
  const byPoints = (a: CriterionResult, b: CriterionResult) => b.points - a.points;
  const matches = criteria.filter((c) => c.status === 'match').sort(byPoints);
  const partials = criteria.filter((c) => c.status === 'partial').sort(byPoints);
  const highlights = [
    ...[...matches, ...partials.slice(0, Math.max(0, 2 - matches.length))].map((c) => c.reasons[0]),
    ...adjustments.filter((a) => a.points > 0).map((a) => a.reason),
  ].filter(Boolean);
  const caveats = [
    ...criteria.filter((c) => c.status === 'unknown' || c.status === 'mismatch').map((c) => c.reasons[0]),
    ...adjustments.filter((a) => a.points < 0).map((a) => a.reason),
  ];

  return {
    perfume,
    score: Math.round(score),
    baseScore: Math.round(baseScore),
    adjustments,
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

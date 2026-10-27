import {
  CLIMATES,
  ENVIRONMENTS,
  FAMILIES,
  INTENSITY_PREFERENCES,
  OCCASIONS,
  PERIODS,
  SCALE_LABELS,
  labelOf,
} from '../../data/options';
import type {
  Climate,
  ClimateThresholds,
  DayPeriod,
  Environment,
  IntensityPreference,
  Occasion,
  OlfactoryFamily,
  Perfume,
  UsageLog,
} from '../../types';

/**
 * Regras de cada critério. Cada função devolve:
 * - ratio 0..1 quando o critério pôde ser avaliado;
 * - status 'unknown' quando faltam dados do PERFUME (reduz a confiança);
 * - status 'not_applicable' quando falta informação do CONTEXTO (critério ignorado).
 * Nenhuma regra infere características a partir da família olfativa.
 */
export interface CriterionEvaluation {
  status: 'evaluated' | 'unknown' | 'not_applicable';
  ratio?: number;
  reasons: string[];
}

export interface ContextWeather {
  temperatureC?: number;
  humidity?: number;
  precipitationProbability?: number;
}

const na = (reason: string): CriterionEvaluation => ({ status: 'not_applicable', reasons: [reason] });
const unknown = (reason: string): CriterionEvaluation => ({ status: 'unknown', reasons: [reason] });
const evaluated = (ratio: number, reasons: string[]): CriterionEvaluation => ({
  status: 'evaluated',
  ratio: Math.max(0, Math.min(1, ratio)),
  reasons,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const listLabels = <T extends string>(opts: { value: T; label: string }[], values: T[]) =>
  values.map((v) => labelOf(opts, v).toLowerCase()).join(', ');

type TempBand = 'hot' | 'mild' | 'cold';

export function temperatureBand(tempC: number, t: ClimateThresholds): TempBand {
  if (tempC >= t.hotMinC) return 'hot';
  if (tempC < t.coldMaxC) return 'cold';
  return 'mild';
}

export function evaluateClimate(
  perfume: Perfume,
  weather: ContextWeather | undefined,
  thresholds: ClimateThresholds,
  fmtTemp: (c: number) => string,
): CriterionEvaluation {
  const hasWeather =
    weather &&
    (weather.temperatureC !== undefined ||
      weather.humidity !== undefined ||
      weather.precipitationProbability !== undefined);
  if (!hasWeather) return na('Sem dados climáticos disponíveis — critério não considerado.');
  if (perfume.climates.length === 0) {
    return unknown('Você ainda não indicou climas preferenciais para este perfume.');
  }

  const parts: { ratio: number; weight: number }[] = [];
  const reasons: string[] = [];
  const tags = new Set<Climate>(perfume.climates);

  if (weather.temperatureC !== undefined) {
    const band = temperatureBand(weather.temperatureC, thresholds);
    const tempTags = perfume.climates.filter((c): c is TempBand => c === 'hot' || c === 'mild' || c === 'cold');
    const bandLabel = labelOf(CLIMATES, band).toLowerCase();
    if (tempTags.length > 0) {
      let ratio: number;
      if (tags.has(band)) {
        ratio = 1;
        reasons.push(`Marcado para clima ${bandLabel}, e agora faz ${fmtTemp(weather.temperatureC)}.`);
      } else if (band === 'mild' || tags.has('mild')) {
        ratio = 0.55;
        reasons.push(
          `Marcado para ${listLabels(CLIMATES, tempTags)}; agora o clima está ${bandLabel} (${fmtTemp(weather.temperatureC)}).`,
        );
      } else {
        ratio = 0.1;
        reasons.push(
          `Marcado para ${listLabels(CLIMATES, tempTags)}, mas agora o clima está ${bandLabel} (${fmtTemp(weather.temperatureC)}).`,
        );
      }
      parts.push({ ratio, weight: 0.7 });
    } else {
      reasons.push('Sem indicação de temperatura preferencial para este perfume.');
    }
  }

  if (weather.humidity !== undefined && (weather.humidity >= 70 || weather.humidity <= 35)) {
    const humid = weather.humidity >= 70;
    const wanted: Climate = humid ? 'humid' : 'dry';
    const opposite: Climate = humid ? 'dry' : 'humid';
    if (tags.has(wanted)) {
      parts.push({ ratio: 1, weight: 0.15 });
      reasons.push(`Marcado para tempo ${humid ? 'úmido' : 'seco'} (umidade de ${weather.humidity}%).`);
    } else if (tags.has(opposite)) {
      parts.push({ ratio: 0.2, weight: 0.15 });
      reasons.push(`Marcado para tempo ${humid ? 'seco' : 'úmido'}, mas a umidade está em ${weather.humidity}%.`);
    }
  }

  if (weather.precipitationProbability !== undefined && weather.precipitationProbability >= 50 && tags.has('rainy')) {
    parts.push({ ratio: 1, weight: 0.15 });
    reasons.push(`Marcado para dias chuvosos (chance de chuva de ${weather.precipitationProbability}%).`);
  }

  if (parts.length === 0) {
    return unknown('As condições atuais não correspondem a nenhuma preferência climática informada.');
  }
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return evaluated(parts.reduce((s, p) => s + p.ratio * p.weight, 0) / totalWeight, reasons);
}

export function evaluateOccasion(perfume: Perfume, occasion: Occasion | undefined): CriterionEvaluation {
  if (!occasion) return na('Nenhuma ocasião informada — critério não considerado.');
  if (perfume.occasions.length === 0) return unknown('Nenhuma ocasião indicada para este perfume.');
  const label = labelOf(OCCASIONS, occasion).toLowerCase();
  if (perfume.occasions.includes(occasion)) return evaluated(1, [`Indicado por você para ${label}.`]);
  return evaluated(0, [`${cap(label)} não está entre as ocasiões marcadas (${listLabels(OCCASIONS, perfume.occasions)}).`]);
}

/** Tabelas de adequação da projeção (1–5) a cada ambiente. */
const ENVIRONMENT_TABLE: Record<Environment, number[]> = {
  indoor: [1, 1, 0.75, 0.4, 0.2],
  outdoor: [0.4, 0.6, 0.85, 1, 1],
  both: [0.45, 0.75, 1, 0.75, 0.45],
};

export function evaluateEnvironment(perfume: Perfume, environment: Environment | undefined): CriterionEvaluation {
  if (!environment) return na('Ambiente não informado — critério não considerado.');
  const usingProjection = perfume.projection !== undefined;
  const level = perfume.projection ?? perfume.intensity;
  if (level === undefined) return unknown('Projeção e intensidade não informadas para este perfume.');
  const ratio = ENVIRONMENT_TABLE[environment][level - 1];
  const what = usingProjection
    ? `Projeção ${SCALE_LABELS.projection[level - 1].toLowerCase()}`
    : `Intensidade ${SCALE_LABELS.intensity[level - 1].toLowerCase()} (projeção não informada)`;
  const envLabel = labelOf(ENVIRONMENTS, environment).toLowerCase();
  const verdict = ratio >= 0.8 ? 'combina com' : ratio >= 0.5 ? 'é aceitável para' : 'pode ser excessiva ou fraca para';
  return evaluated(ratio, [`${what} ${verdict} ${envLabel}.`]);
}

const PERIOD_ORDER: DayPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

export function evaluatePeriod(perfume: Perfume, period: DayPeriod | undefined): CriterionEvaluation {
  if (!period) return na('Período não informado — critério não considerado.');
  if (perfume.periods.length === 0) return unknown('Nenhum período de uso indicado para este perfume.');
  const label = labelOf(PERIODS, period).toLowerCase();
  if (perfume.periods.includes(period)) return evaluated(1, [`Você costuma indicá-lo para o período da ${label}.`]);
  const idx = PERIOD_ORDER.indexOf(period);
  const adjacent = perfume.periods.some((p) => Math.abs(PERIOD_ORDER.indexOf(p) - idx) === 1);
  return evaluated(adjacent ? 0.5 : 0, [
    `Marcado para ${listLabels(PERIODS, perfume.periods)}; agora é ${label}.`,
  ]);
}

const INTENSITY_TARGET: Record<IntensityPreference, number> = { discreet: 1.5, moderate: 3, strong: 4.5 };

export interface PersonalInputs {
  favoriteFamilies: OlfactoryFamily[];
  dislikedFamilies: OlfactoryFamily[];
  intensity?: IntensityPreference;
  preferredFamily?: OlfactoryFamily;
  logs: UsageLog[];
}

export function evaluatePersonal(perfume: Perfume, input: PersonalInputs): CriterionEvaluation {
  const signals: { ratio: number; reason: string }[] = [];
  const notes: string[] = [];
  const familyLabel = perfume.family ? labelOf(FAMILIES, perfume.family).toLowerCase() : undefined;

  if (input.preferredFamily) {
    if (!perfume.family) {
      notes.push('Família olfativa não informada: a preferência de hoje não pôde ser avaliada.');
    } else if (perfume.family === input.preferredFamily) {
      signals.push({ ratio: 1, reason: `É da família ${familyLabel}, como você pediu hoje.` });
    } else {
      signals.push({
        ratio: 0.2,
        reason: `Você pediu ${labelOf(FAMILIES, input.preferredFamily).toLowerCase()}; este é ${familyLabel}.`,
      });
    }
  }
  if (perfume.family && input.favoriteFamilies.includes(perfume.family)) {
    signals.push({ ratio: 1, reason: `${cap(familyLabel!)} está entre suas famílias favoritas.` });
  }
  if (perfume.family && input.dislikedFamilies.includes(perfume.family)) {
    signals.push({ ratio: 0, reason: `${cap(familyLabel!)} está entre as famílias que você menos aprecia.` });
  }
  if (perfume.favorite) signals.push({ ratio: 1, reason: 'Marcado como favorito.' });
  if (perfume.rating) {
    signals.push({ ratio: (perfume.rating - 1) / 4, reason: `Sua avaliação pessoal: ${perfume.rating}/5.` });
  }
  const rated = input.logs.filter((l) => l.perfumeId === perfume.id && l.rating);
  if (rated.length > 0) {
    const avg = rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length;
    signals.push({
      ratio: (avg - 1) / 4,
      reason: `Média de ${avg.toFixed(1)}/5 em ${rated.length} ${rated.length === 1 ? 'avaliação' : 'avaliações'} após o uso.`,
    });
  }
  if (input.intensity && perfume.intensity) {
    const diff = Math.abs(perfume.intensity - INTENSITY_TARGET[input.intensity]);
    signals.push({
      ratio: 1 - diff / 3,
      reason: `Intensidade ${SCALE_LABELS.intensity[perfume.intensity - 1].toLowerCase()} para uma preferência ${labelOf(
        INTENSITY_PREFERENCES,
        input.intensity,
      ).toLowerCase()}.`,
    });
  }

  if (signals.length === 0) {
    return unknown(notes[0] ?? 'Sem avaliações ou preferências registradas para comparar.');
  }
  const ratio = signals.reduce((s, x) => s + x.ratio, 0) / signals.length;
  return evaluated(ratio, [...signals.map((s) => s.reason), ...notes]);
}

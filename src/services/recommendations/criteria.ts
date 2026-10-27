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
import { describeWarmth, idealWarmth, olfactoryProfile } from './profile';

/**
 * Regras de cada critério. Cada função devolve:
 * - ratio 0..1 quando o critério pôde ser avaliado;
 * - certainty 0..1: 1 quando a avaliação usa o que VOCÊ marcou no perfume;
 *   menor quando vem só de heurísticas (acordes, intensidade) — reduz a confiança;
 * - status 'unknown' quando faltam dados do PERFUME (reduz a confiança);
 * - status 'not_applicable' quando falta informação do CONTEXTO (critério ignorado).
 * A família olfativa sozinha nunca é usada para julgar clima ou período.
 */
export interface CriterionEvaluation {
  status: 'evaluated' | 'unknown' | 'not_applicable';
  ratio?: number;
  certainty?: number;
  reasons: string[];
}

export interface ContextWeather {
  temperatureC?: number;
  apparentTemperatureC?: number;
  humidity?: number;
  precipitationProbability?: number;
}

const na = (reason: string): CriterionEvaluation => ({ status: 'not_applicable', reasons: [reason] });
const unknown = (reason: string): CriterionEvaluation => ({ status: 'unknown', reasons: [reason] });
const evaluated = (ratio: number, reasons: string[], certainty = 1): CriterionEvaluation => ({
  status: 'evaluated',
  ratio: Math.max(0, Math.min(1, ratio)),
  certainty,
  reasons,
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const listLabels = <T extends string>(opts: { value: T; label: string }[], values: T[]) =>
  values.map((v) => labelOf(opts, v).toLowerCase()).join(', ');

/** Média ponderada de partes { ratio, weight }. */
function blend(parts: { ratio: number; weight: number }[]): number {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  return total > 0 ? parts.reduce((s, p) => s + p.ratio * p.weight, 0) / total : 0;
}

/**
 * Quanto mais opções marcadas, menos específica é a indicação. Um perfume
 * marcado para "todas as ocasiões" combina, mas não deve empatar com um
 * escolhido a dedo para aquela ocasião.
 */
function specificity(count: number, total: number): number {
  if (count <= 1) return 1;
  const share = (count - 1) / Math.max(1, total - 1);
  return 1 - 0.24 * share;
}

/** Projeção quando informada; senão intensidade. */
const strength = (p: Perfume) => p.projection ?? p.intensity;

type TempBand = 'hot' | 'mild' | 'cold';

export function temperatureBand(tempC: number, t: ClimateThresholds): TempBand {
  if (tempC >= t.hotMinC) return 'hot';
  if (tempC < t.coldMaxC) return 'cold';
  return 'mild';
}

/** Aderência gradual (0–1) da temperatura a uma faixa marcada. */
function bandFit(band: TempBand, tempC: number, t: ClimateThresholds): number {
  if (band === 'hot') return tempC >= t.hotMinC ? 1 : clamp01(1 - (t.hotMinC - tempC) / 10);
  if (band === 'cold') return tempC < t.coldMaxC ? 1 : clamp01(1 - (tempC - t.coldMaxC) / 10);
  const dist = tempC < t.coldMaxC ? t.coldMaxC - tempC : tempC >= t.hotMinC ? tempC - t.hotMinC : 0;
  return clamp01(1 - dist / 8);
}

export function evaluateClimate(
  perfume: Perfume,
  weather: ContextWeather | undefined,
  thresholds: ClimateThresholds,
  fmtTemp: (c: number) => string,
): CriterionEvaluation {
  const temp = weather?.apparentTemperatureC ?? weather?.temperatureC;
  const hasWeather =
    weather && (temp !== undefined || weather.humidity !== undefined || weather.precipitationProbability !== undefined);
  if (!hasWeather) return na('Sem dados climáticos disponíveis — critério não considerado.');

  const parts: { ratio: number; weight: number }[] = [];
  const reasons: string[] = [];
  const tags = new Set<Climate>(perfume.climates);
  const tempTags = perfume.climates.filter((c): c is TempBand => c === 'hot' || c === 'mild' || c === 'cold');
  const profile = olfactoryProfile(perfume);
  let fromUserTags = false;

  if (temp !== undefined) {
    const band = temperatureBand(temp, thresholds);
    const bandLabel = labelOf(CLIMATES, band).toLowerCase();
    const tempText =
      weather.apparentTemperatureC !== undefined ? `${fmtTemp(temp)} de sensação térmica` : fmtTemp(temp);

    // 1. O que você marcou no perfume (peso maior).
    if (tempTags.length > 0) {
      fromUserTags = true;
      const fit = Math.max(...tempTags.map((b) => bandFit(b, temp, thresholds)));
      const spec = specificity(tempTags.length, 3);
      parts.push({ ratio: fit * spec, weight: 0.55 });
      if (fit >= 0.95) {
        reasons.push(
          tempTags.length === 3
            ? `Marcado para qualquer temperatura (versátil); agora faz ${tempText}.`
            : `Marcado para clima ${bandLabel}, e agora faz ${tempText}.`,
        );
      } else if (fit >= 0.5) {
        reasons.push(`Marcado para ${listLabels(CLIMATES, tempTags)}; está ${bandLabel} (${tempText}), perto da faixa.`);
      } else {
        reasons.push(`Marcado para ${listLabels(CLIMATES, tempTags)}, mas agora está ${bandLabel} (${tempText}).`);
      }
    }

    // 2. Perfil olfativo pelos acordes e notas cadastrados.
    if (profile) {
      const ideal = idealWarmth(temp);
      const ratio = clamp01(1 - Math.abs(profile.warmth - ideal) * 0.75);
      parts.push({ ratio, weight: tempTags.length > 0 ? 0.3 : 0.6 });
      const kind = describeWarmth(profile.warmth);
      const drivers = profile.drivers.length ? ` (${profile.drivers.join(', ')})` : '';
      if (ratio >= 0.75) reasons.push(`Perfil ${kind}${drivers} combina com ${tempText}.`);
      else if (ratio >= 0.45) reasons.push(`Perfil ${kind}${drivers}: razoável para ${tempText}.`);
      else
        reasons.push(
          `Perfil ${kind}${drivers} tende a ${profile.warmth > ideal ? 'pesar' : 'sumir'} com ${tempText}.`,
        );
    }

    // 3. Força do perfume x temperatura: calor amplifica, frio abafa.
    const s = strength(perfume);
    if (s !== undefined) {
      if (band === 'hot' && s >= 4) {
        parts.push({ ratio: s === 5 ? 0.15 : 0.4, weight: 0.15 });
        reasons.push('Projeção forte costuma ficar enjoativa no calor — use com moderação.');
      } else if (band === 'hot' && s <= 2) {
        parts.push({ ratio: 1, weight: 0.1 });
      } else if (band === 'cold' && s <= 1) {
        parts.push({ ratio: 0.5, weight: 0.1 });
        reasons.push('Muito suave para o frio — pode quase não ser percebido.');
      }
    }
  }

  if (weather.humidity !== undefined && (weather.humidity >= 70 || weather.humidity <= 35)) {
    const humid = weather.humidity >= 70;
    const wanted: Climate = humid ? 'humid' : 'dry';
    const opposite: Climate = humid ? 'dry' : 'humid';
    if (tags.has(wanted)) {
      fromUserTags = true;
      parts.push({ ratio: 1, weight: 0.12 });
      reasons.push(`Marcado para tempo ${humid ? 'úmido' : 'seco'} (umidade de ${weather.humidity}%).`);
    } else if (tags.has(opposite)) {
      fromUserTags = true;
      parts.push({ ratio: 0.2, weight: 0.12 });
      reasons.push(`Marcado para tempo ${humid ? 'seco' : 'úmido'}, mas a umidade está em ${weather.humidity}%.`);
    } else if (humid && profile && profile.warmth > 0.5) {
      // Umidade alta realça doçura e resinas.
      parts.push({ ratio: 0.5, weight: 0.08 });
      reasons.push(`Com ${weather.humidity}% de umidade, acordes densos ficam mais pesados.`);
    }
  }

  if (weather.precipitationProbability !== undefined && weather.precipitationProbability >= 50 && tags.has('rainy')) {
    fromUserTags = true;
    parts.push({ ratio: 1, weight: 0.12 });
    reasons.push(`Marcado para dias chuvosos (chance de chuva de ${weather.precipitationProbability}%).`);
  }

  if (parts.length === 0) {
    return perfume.climates.length === 0
      ? unknown('Sem climas marcados nem acordes/notas suficientes para avaliar o clima.')
      : unknown('As condições atuais não correspondem a nenhuma preferência climática informada.');
  }
  return evaluated(blend(parts), reasons, fromUserTags ? 1 : 0.6);
}

/** Ocasiões parecidas recebem crédito parcial. */
const RELATED_OCCASIONS: Record<Occasion, Occasion[]> = {
  work: ['daily', 'formal'],
  daily: ['work', 'casual', 'travel'],
  casual: ['daily', 'travel', 'date'],
  date: ['party', 'casual', 'formal'],
  party: ['date', 'formal'],
  formal: ['work', 'date', 'party'],
  sport: ['casual', 'home'],
  travel: ['daily', 'casual'],
  home: ['casual', 'daily'],
};

/** Projeção ideal (1–5) para cada ocasião. */
const OCCASION_STRENGTH: Record<Occasion, number> = {
  work: 2,
  daily: 2.5,
  casual: 3,
  date: 3.5,
  party: 4.5,
  formal: 3.5,
  sport: 1.5,
  travel: 2.5,
  home: 1.5,
};

export function evaluateOccasion(perfume: Perfume, occasion: Occasion | undefined): CriterionEvaluation {
  if (!occasion) return na('Nenhuma ocasião informada — critério não considerado.');
  const label = labelOf(OCCASIONS, occasion).toLowerCase();
  const s = strength(perfume);
  const parts: { ratio: number; weight: number }[] = [];
  const reasons: string[] = [];

  if (perfume.occasions.length > 0) {
    if (perfume.occasions.includes(occasion)) {
      const spec = specificity(perfume.occasions.length, OCCASIONS.length);
      parts.push({ ratio: spec, weight: 0.75 });
      reasons.push(
        perfume.occasions.length >= 6
          ? `Indicado para ${label}, entre quase todas as ocasiões (versátil, menos específico).`
          : `Indicado por você para ${label}.`,
      );
    } else if (perfume.occasions.some((o) => RELATED_OCCASIONS[occasion].includes(o))) {
      parts.push({ ratio: 0.45, weight: 0.75 });
      reasons.push(`Não marcado para ${label}, mas sim para ocasiões parecidas (${listLabels(OCCASIONS, perfume.occasions)}).`);
    } else {
      parts.push({ ratio: 0, weight: 0.75 });
      reasons.push(`${cap(label)} não está entre as ocasiões marcadas (${listLabels(OCCASIONS, perfume.occasions)}).`);
    }
  }

  if (s !== undefined) {
    const diff = Math.abs(s - OCCASION_STRENGTH[occasion]);
    const ratio = clamp01(1 - diff / 3.5);
    parts.push({ ratio, weight: 0.25 });
    if (diff >= 1.5) {
      reasons.push(
        s > OCCASION_STRENGTH[occasion]
          ? `Projeção ${SCALE_LABELS.projection[s - 1].toLowerCase()} pode ser demais para ${label}.`
          : `Projeção ${SCALE_LABELS.projection[s - 1].toLowerCase()} pode passar despercebida em ${label}.`,
      );
    } else if (perfume.occasions.length === 0) {
      reasons.push(`Projeção ${SCALE_LABELS.projection[s - 1].toLowerCase()} adequada para ${label}.`);
    }
  }

  if (parts.length === 0) return unknown('Nenhuma ocasião nem projeção indicada para este perfume.');
  return evaluated(blend(parts), reasons, perfume.occasions.length > 0 ? 1 : 0.5);
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
  const level = strength(perfume);
  if (level === undefined) return unknown('Projeção e intensidade não informadas para este perfume.');
  let ratio = ENVIRONMENT_TABLE[environment][level - 1];
  const what = usingProjection
    ? `Projeção ${SCALE_LABELS.projection[level - 1].toLowerCase()}`
    : `Intensidade ${SCALE_LABELS.intensity[level - 1].toLowerCase()} (projeção não informada)`;
  const envLabel = labelOf(ENVIRONMENTS, environment).toLowerCase();
  const verdict = ratio >= 0.8 ? 'combina com' : ratio >= 0.5 ? 'é aceitável para' : 'pode ser excessiva ou fraca para';
  const reasons = [`${what} ${verdict} ${envLabel}.`];
  // Ao ar livre o perfume evapora mais rápido: fixação longa ajuda.
  if (environment !== 'indoor' && perfume.longevity !== undefined) {
    ratio = ratio * 0.85 + (perfume.longevity / 5) * 0.15;
    if (perfume.longevity >= 4) reasons.push('Boa fixação para passar o dia fora.');
    if (perfume.longevity <= 2) reasons.push('Fixação curta: pode precisar reaplicar.');
  }
  return evaluated(ratio, reasons, usingProjection ? 1 : 0.8);
}

const PERIOD_ORDER: DayPeriod[] = ['morning', 'afternoon', 'evening', 'night'];
/** Perfil ideal por período: mais fresco de dia, mais envolvente à noite. */
const PERIOD_WARMTH: Record<DayPeriod, number> = { morning: -0.4, afternoon: -0.2, evening: 0.4, night: 0.5 };

export function evaluatePeriod(perfume: Perfume, period: DayPeriod | undefined): CriterionEvaluation {
  if (!period) return na('Período não informado — critério não considerado.');
  const label = labelOf(PERIODS, period).toLowerCase();
  const profile = olfactoryProfile(perfume);
  const parts: { ratio: number; weight: number }[] = [];
  const reasons: string[] = [];

  if (perfume.periods.length > 0) {
    const spec = specificity(perfume.periods.length, PERIODS.length);
    if (perfume.periods.includes(period)) {
      parts.push({ ratio: spec, weight: 0.75 });
      reasons.push(`Você costuma indicá-lo para o período da ${label}.`);
    } else {
      const idx = PERIOD_ORDER.indexOf(period);
      const adjacent = perfume.periods.some((p) => Math.abs(PERIOD_ORDER.indexOf(p) - idx) === 1);
      parts.push({ ratio: adjacent ? 0.5 : 0, weight: 0.75 });
      reasons.push(`Marcado para ${listLabels(PERIODS, perfume.periods)}; agora é ${label}.`);
    }
  }
  if (profile) {
    const ratio = clamp01(1 - Math.abs(profile.warmth - PERIOD_WARMTH[period]) * 0.6);
    parts.push({ ratio, weight: 0.25 });
    if (perfume.periods.length === 0 || ratio < 0.5) {
      reasons.push(
        ratio >= 0.6
          ? `Perfil ${describeWarmth(profile.warmth)} cai bem na ${label}.`
          : `Perfil ${describeWarmth(profile.warmth)} é menos típico para a ${label}.`,
      );
    }
  }
  if (parts.length === 0) return unknown('Nenhum período de uso indicado para este perfume.');
  return evaluated(blend(parts), reasons, perfume.periods.length > 0 ? 1 : 0.5);
}

const INTENSITY_TARGET: Record<IntensityPreference, number> = { discreet: 1.5, moderate: 3, strong: 4.5 };

export interface PersonalInputs {
  favoriteFamilies: OlfactoryFamily[];
  dislikedFamilies: OlfactoryFamily[];
  intensity?: IntensityPreference;
  preferredFamily?: OlfactoryFamily;
  logs: UsageLog[];
  /** Contexto atual, para aprender com usos em situações parecidas. */
  occasion?: Occasion;
  temperatureC?: number;
}

/** Peso da "opinião neutra" que evita que um único sinal leve o critério a 100%. */
const PRIOR_WEIGHT = 0.6;
const PRIOR_RATIO = 0.5;

export function evaluatePersonal(perfume: Perfume, input: PersonalInputs): CriterionEvaluation {
  const signals: { ratio: number; weight: number; reason: string }[] = [];
  const notes: string[] = [];
  const familyLabel = perfume.family ? labelOf(FAMILIES, perfume.family).toLowerCase() : undefined;

  if (input.preferredFamily) {
    if (!perfume.family) {
      notes.push('Família olfativa não informada: a preferência de hoje não pôde ser avaliada.');
    } else if (perfume.family === input.preferredFamily) {
      signals.push({ ratio: 1, weight: 2, reason: `É da família ${familyLabel}, como você pediu hoje.` });
    } else {
      signals.push({
        ratio: 0.15,
        weight: 2,
        reason: `Você pediu ${labelOf(FAMILIES, input.preferredFamily).toLowerCase()}; este é ${familyLabel}.`,
      });
    }
  }
  if (perfume.family && input.favoriteFamilies.includes(perfume.family)) {
    signals.push({ ratio: 1, weight: 0.8, reason: `${cap(familyLabel!)} está entre suas famílias favoritas.` });
  }
  if (perfume.family && input.dislikedFamilies.includes(perfume.family)) {
    signals.push({ ratio: 0, weight: 1.5, reason: `${cap(familyLabel!)} está entre as famílias que você menos aprecia.` });
  }
  if (perfume.favorite) signals.push({ ratio: 1, weight: 1, reason: 'Marcado como favorito.' });
  if (perfume.rating) {
    signals.push({ ratio: (perfume.rating - 1) / 4, weight: 1.5, reason: `Sua avaliação pessoal: ${perfume.rating}/5.` });
  }

  const rated = input.logs.filter((l) => l.perfumeId === perfume.id && l.rating);
  if (rated.length > 0) {
    const avg = rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length;
    signals.push({
      ratio: (avg - 1) / 4,
      weight: Math.min(2, 0.6 + rated.length * 0.3),
      reason: `Média de ${avg.toFixed(1)}/5 em ${rated.length} ${rated.length === 1 ? 'avaliação' : 'avaliações'} após o uso.`,
    });

    // Aprende com usos em situação parecida (mesma ocasião ou temperatura próxima).
    const similar = rated.filter((l) => {
      const sameOccasion = input.occasion !== undefined && l.occasion === input.occasion;
      const t = l.weather?.apparentTemperatureC ?? l.weather?.temperatureC;
      const sameWeather = input.temperatureC !== undefined && t !== undefined && Math.abs(t - input.temperatureC) <= 4;
      return sameOccasion || sameWeather;
    });
    if (similar.length > 0) {
      const sAvg = similar.reduce((s, l) => s + (l.rating ?? 0), 0) / similar.length;
      signals.push({
        ratio: (sAvg - 1) / 4,
        weight: Math.min(2.5, 1 + similar.length * 0.5),
        reason: `Em ${similar.length} ${similar.length === 1 ? 'uso' : 'usos'} em situação parecida, você deu ${sAvg.toFixed(1)}/5.`,
      });
    }
  }

  if (input.intensity && perfume.intensity) {
    const diff = Math.abs(perfume.intensity - INTENSITY_TARGET[input.intensity]);
    signals.push({
      ratio: 1 - diff / 3.5,
      weight: 1,
      reason: `Intensidade ${SCALE_LABELS.intensity[perfume.intensity - 1].toLowerCase()} para uma preferência ${labelOf(
        INTENSITY_PREFERENCES,
        input.intensity,
      ).toLowerCase()}.`,
    });
  }

  if (signals.length === 0) {
    return unknown(notes[0] ?? 'Sem avaliações ou preferências registradas para comparar.');
  }
  const total = signals.reduce((s, x) => s + x.weight, 0) + PRIOR_WEIGHT;
  const ratio = (signals.reduce((s, x) => s + x.ratio * x.weight, 0) + PRIOR_RATIO * PRIOR_WEIGHT) / total;
  return evaluated(ratio, [...signals.map((s) => s.reason), ...notes]);
}

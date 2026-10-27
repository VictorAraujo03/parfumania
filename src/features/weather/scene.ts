import type { ClimateThresholds, WeatherSnapshot } from '../../types';

/** Cena animada do cartão de clima. */
export type WeatherSceneKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

/** Sensação térmica, para colorir a cena e escrever o resumo (calor seco, ameno…). */
export type WeatherFeel = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

export interface WeatherScene {
  kind: WeatherSceneKind;
  night: boolean;
  feel?: WeatherFeel;
  dry: boolean;
  humid: boolean;
  /** Resumo curto: "Calor seco", "Ameno e úmido"… */
  summary?: string;
}

export function kindFromCode(code: number): WeatherSceneKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'partly';
}

/** Sem código (clima informado manualmente): deduz apenas pelo que foi informado. */
function kindFromValues(s: WeatherSnapshot): WeatherSceneKind {
  const rain = s.precipitationProbability;
  if (rain !== undefined && rain >= 70) return 'rain';
  if (rain !== undefined && rain >= 45) return 'drizzle';
  if (s.humidity !== undefined && s.humidity >= 85) return 'cloudy';
  if (rain !== undefined && rain >= 25) return 'partly';
  return 'clear';
}

function feelOf(tempC: number, t: ClimateThresholds): WeatherFeel {
  if (tempC >= t.hotMinC + 4) return 'hot';
  if (tempC >= t.hotMinC) return 'warm';
  if (tempC >= t.coldMaxC) return 'mild';
  if (tempC >= t.coldMaxC - 6) return 'cool';
  return 'cold';
}

const FEEL_LABEL: Record<WeatherFeel, string> = {
  hot: 'Calor forte',
  warm: 'Calor',
  mild: 'Ameno',
  cool: 'Fresco',
  cold: 'Frio',
};

export function sceneOf(s: WeatherSnapshot, thresholds: ClimateThresholds, now = new Date()): WeatherScene {
  const kind = s.weatherCode !== undefined ? kindFromCode(s.weatherCode) : kindFromValues(s);
  const hour = now.getHours();
  const night = s.isDay !== undefined ? !s.isDay : hour < 6 || hour >= 18;
  const temp = s.apparentTemperatureC ?? s.temperatureC;
  const feel = temp !== undefined ? feelOf(temp, thresholds) : undefined;
  const dry = s.humidity !== undefined && s.humidity <= 35;
  const humid = s.humidity !== undefined && s.humidity >= 75;

  let summary: string | undefined;
  if (feel) {
    summary = FEEL_LABEL[feel];
    if (dry) summary += feel === 'mild' ? ' e seco' : ' seco';
    else if (humid && kind !== 'rain' && kind !== 'storm' && kind !== 'drizzle')
      summary += feel === 'mild' ? ' e úmido' : ' úmido';
  }
  return { kind, night, feel, dry, humid, summary };
}

/** Dica olfativa curta para o dia, a partir da cena (heurística de perfumaria). */
export function sceneTip(scene: WeatherScene): string | undefined {
  if (scene.kind === 'rain' || scene.kind === 'storm' || scene.kind === 'drizzle')
    return 'Dia chuvoso: amadeirados e especiados suaves ficam aconchegantes.';
  if (scene.feel === 'hot' || scene.feel === 'warm')
    return scene.dry
      ? 'Calor seco: cítricos e aromáticos rendem, mas evaporam rápido — reaplique.'
      : 'Calor: prefira frescos, cítricos e aquáticos, com projeção leve.';
  if (scene.feel === 'cold' || scene.feel === 'cool')
    return 'Frio: âmbar, baunilha e resinas se expandem melhor na pele.';
  if (scene.feel === 'mild') return 'Clima ameno: quase tudo funciona — bom dia para variar.';
  return undefined;
}

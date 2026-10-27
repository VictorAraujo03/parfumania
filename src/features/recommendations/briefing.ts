import { ENVIRONMENTS, FAMILIES, OCCASIONS, PERIODS, labelOf } from '../../data/options';
import type { DayPeriod, Environment, Occasion, UsageLog } from '../../types';
import type { Recommendation } from '../../services/recommendations/engine';
import { describeWarmth, idealWarmth, olfactoryProfile } from '../../services/recommendations/profile';
import { daysBetween } from '../../utils/date';
import type { WeatherScene } from '../weather/scene';

/**
 * Transforma uma recomendação em um resumo detalhado "para agora": o momento,
 * por que este perfume, pontos a favor, cuidados, como aplicar e o que você
 * vai sentir. Usa apenas dados do perfume, do clima e dos seus registros.
 */
export interface Briefing {
  /** "Madrugada fresca e úmida · 13 °C · Trabalho" */
  moment: string;
  /** Frase principal: por que este perfume agora. */
  summary: string;
  details: string[];
  cautions: string[];
  /** Dica de aplicação (estimativa a partir da projeção informada). */
  tip?: string;
  /** Acordes ou notas principais cadastrados. */
  notes: string[];
}

export interface BriefingContext {
  period: DayPeriod;
  temperatureC?: number;
  scene?: WeatherScene;
  occasion?: Occasion;
  environment?: Environment;
  logs: UsageLog[];
  now?: Date;
  formatTemperature: (c: number) => string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Razões que são ressalvas, mesmo dentro de um critério que pontuou. */
const CAUTION = /pode |tende |, mas |demais|despercebida|curta|reaplicar/i;

/** Adjetivos no feminino (manhã, tarde, noite, madrugada). */
function momentAdjectives(scene: WeatherScene | undefined): string {
  if (!scene) return '';
  const feel = scene.feel
    ? { hot: 'quente', warm: 'quente', mild: 'amena', cool: 'fresca', cold: 'fria' }[scene.feel]
    : undefined;
  const wet = ['rain', 'drizzle', 'storm'].includes(scene.kind)
    ? 'chuvosa'
    : scene.kind === 'snow'
      ? 'com neve'
      : scene.kind === 'fog'
        ? 'com neblina'
        : scene.dry
          ? 'seca'
          : scene.humid
            ? 'úmida'
            : undefined;
  return [feel, wet].filter(Boolean).join(' e ');
}

function timesLabel(n: number) {
  return n === 1 ? '1 vez' : `${n} vezes`;
}

/** Quantas borrifadas e onde, a partir da força do perfume e do clima. */
function applicationTip(rec: Recommendation, ctx: BriefingContext): string | undefined {
  const p = rec.perfume;
  const strength = p.projection ?? p.intensity;
  if (strength === undefined) return undefined;
  let sprays = [5, 4, 3, 2, 1][strength - 1];
  const feel = ctx.scene?.feel;
  if (feel === 'hot' || feel === 'warm') sprays -= 1;
  if (feel === 'cold') sprays += 1;
  if (ctx.environment === 'indoor' && strength >= 4) sprays = 1;
  if (ctx.occasion === 'work' || ctx.occasion === 'sport') sprays = Math.min(sprays, 2);
  sprays = Math.max(1, Math.min(6, sprays));
  const amount = sprays === 1 ? '1 borrifada' : `${Math.max(1, sprays - 1)}–${sprays} borrifadas`;

  const where =
    feel === 'hot' || feel === 'warm'
      ? 'nos pulsos e atrás das orelhas; evite a roupa sob sol forte'
      : feel === 'cold' || feel === 'cool'
        ? 'no pescoço e no peito — o calor do corpo ajuda a projetar; um toque no cachecol prolonga'
        : 'no pescoço e nos pulsos';
  const refresh =
    (p.longevity !== undefined && p.longevity <= 2) || (ctx.scene?.dry && (feel === 'hot' || feel === 'warm'))
      ? ' Leve para reaplicar: a fixação tende a ser curta hoje.'
      : '';
  return `${amount} ${where}.${refresh}`;
}

export function buildBriefing(rec: Recommendation, ctx: BriefingContext): Briefing {
  const p = rec.perfume;
  const now = ctx.now ?? new Date();
  const fmt = ctx.formatTemperature;

  // Momento
  const periodLabel = labelOf(PERIODS, ctx.period);
  const adj = momentAdjectives(ctx.scene);
  const moment = [
    `${periodLabel}${adj ? ` ${adj}` : ''}`,
    ctx.temperatureC !== undefined ? fmt(ctx.temperatureC) : null,
    ctx.occasion ? labelOf(OCCASIONS, ctx.occasion) : null,
    ctx.environment ? labelOf(ENVIRONMENTS, ctx.environment) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Por que este perfume
  const profile = olfactoryProfile(p);
  let summary: string;
  if (profile) {
    const drivers = profile.drivers.length ? ` (${profile.drivers.join(', ')})` : '';
    let fit = '';
    if (ctx.temperatureC !== undefined) {
      const diff = profile.warmth - idealWarmth(ctx.temperatureC);
      fit =
        Math.abs(diff) < 0.5
          ? ', na medida para o tempo de agora'
          : diff > 0
            ? ', mais encorpado do que o tempo pede — vá com calma na aplicação'
            : ', mais leve do que o tempo pede — ótimo se você quer discrição';
    }
    summary = `Perfil ${describeWarmth(profile.warmth)}${drivers}${fit}.`;
  } else if (p.family) {
    summary = `Da família ${labelOf(FAMILIES, p.family).toLowerCase()} — escolhido pelo que você marcou neste perfume.`;
  } else {
    summary = 'Escolhido pelo que você marcou neste perfume.';
  }

  // A favor: razões dos critérios que pontuaram, da maior contribuição para a menor.
  const seen = new Set<string>();
  const details: string[] = [];
  const push = (list: string[], text: string) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    list.push(text);
  };
  [...rec.criteria]
    .filter((c) => c.status === 'match' || c.status === 'partial')
    .sort((a, b) => b.points - a.points)
    .forEach((c) =>
      c.reasons
        .filter((r) => !(profile && r.startsWith('Perfil')))
        .filter((r) => !CAUTION.test(r))
        .forEach((r) => push(details, r)),
    );
  rec.adjustments.filter((a) => a.points > 0).forEach((a) => push(details, a.reason));

  // Histórico real de uso deste perfume.
  const own = ctx.logs.filter((l) => l.perfumeId === p.id);
  if (own.length > 0) {
    const last = own.reduce((m, l) => (l.usedAt > m ? l.usedAt : m), own[0].usedAt);
    const days = daysBetween(new Date(last), now);
    const when = days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
    const rated = own.filter((l) => l.rating);
    const avg = rated.length ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length : undefined;
    push(
      details,
      `Você já usou ${timesLabel(own.length)}; a última foi ${when}${avg !== undefined ? ` (nota média ${avg.toFixed(1)}/5)` : ''}.`,
    );
  }

  // Cuidados: o que não combinou, rodízio e dados que faltam.
  const cautions: string[] = [];
  // O ajuste do perfil ao clima já está no resumo; não repete aqui.
  const notProfile = (r: string) => !(profile && r.startsWith('Perfil'));
  rec.criteria.forEach((c) => {
    const reasons = c.reasons.filter(notProfile);
    if (c.status === 'mismatch') push(cautions, reasons[0] ?? '');
    else reasons.filter((r) => CAUTION.test(r)).forEach((r) => push(cautions, r));
  });
  rec.adjustments.filter((a) => a.points < 0).forEach((a) => push(cautions, a.reason));
  const missing = rec.criteria.filter((c) => c.status === 'unknown').map((c) => c.label.toLowerCase());
  if (missing.length) {
    push(cautions, `Para afinar a nota, complete no perfume: ${missing.join(', ')}.`);
  }

  const notes = (p.accords?.length ? p.accords : [...p.heartNotes, ...p.baseNotes, ...p.topNotes]).slice(0, 6);

  return {
    moment: cap(moment),
    summary,
    details: details.slice(0, 5),
    cautions: cautions.slice(0, 3),
    tip: applicationTip(rec, ctx),
    notes,
  };
}

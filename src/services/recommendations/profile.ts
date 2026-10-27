import type { Perfume } from '../../types';
import { normalize } from '../../utils/text';

/**
 * Perfil olfativo "frio ↔ quente" calculado a partir dos acordes e notas que o
 * perfume REALMENTE tem cadastrados (nunca da família sozinha). É uma
 * heurística de perfumaria: acordes frescos (cítricos, aquáticos, verdes)
 * tendem a funcionar melhor no calor; ambarados, baunilhados e resinosos, no frio.
 *
 * Retorna -1 (muito fresco) a +1 (muito quente), ou undefined se houver
 * menos de dois termos reconhecidos — nesse caso nada é presumido.
 */

/** Valores por termo (normalizado, sem acentos). */
const ACCORD_WARMTH: Record<string, number> = {
  citrico: -1,
  fresco: -0.9,
  aquatico: -1,
  marinho: -1,
  ozonico: -0.9,
  verde: -0.7,
  herbal: -0.5,
  'especiado fresco': -0.4,
  aromatico: -0.4,
  mineral: -0.5,
  salgado: -0.3,
  frutado: -0.3,
  tropical: -0.2,
  lavanda: -0.2,
  conifera: -0.2,
  canforado: -0.4,
  acido: -0.4,
  aldeidico: 0,
  floral: -0.1,
  'floral branco': 0.1,
  'floral amarelo': 0.1,
  rosa: 0.1,
  iris: 0.2,
  atalcado: 0.2,
  almiscarado: 0.1,
  amadeirado: 0.3,
  musgoso: 0.2,
  terroso: 0.3,
  chipre: 0.2,
  fougere: -0.1,
  cremoso: 0.4,
  lactonico: 0.4,
  amendoado: 0.5,
  doce: 0.6,
  'especiado suave': 0.4,
  especiado: 0.5,
  'especiado quente': 0.9,
  canela: 0.8,
  resinoso: 0.8,
  balsamico: 0.8,
  ambar: 0.9,
  oriental: 0.9,
  baunilha: 0.9,
  gourmand: 0.9,
  caramelo: 1,
  mel: 0.8,
  cafe: 0.8,
  cacau: 0.9,
  tabaco: 0.9,
  couro: 0.8,
  defumado: 0.8,
  oud: 1,
  animalico: 0.7,
};

/** Notas: correspondência por trecho (ex.: "Bergamota italiana" contém "bergamota"). */
// A ordem importa: termos mais específicos antes dos genéricos ("melancia" antes de "mel").
const NOTE_WARMTH: [string, number][] = [
  ['flor de laranjeira', 0.1],
  ['melancia', -0.6],
  ['melao', -0.5],
  // "hortelã-pimenta" é fresca; "pimenta" contém "menta": por isso vêm antes.
  ['hortela', -1],
  ['pimenta', 0.3],
  ['menta', -1],
  ['bergamota', -0.9],
  ['limao', -1],
  ['lima', -0.9],
  ['toranja', -0.9],
  ['tangerina', -0.8],
  ['laranja', -0.7],
  ['neroli', -0.6],
  ['petitgrain', -0.7],
  ['yuzu', -0.9],
  ['cidra', -0.9],
  ['pepino', -1],
  ['aquatic', -1],
  ['marinh', -1],
  ['ozon', -0.9],
  ['cha verde', -0.7],
  ['alecrim', -0.5],
  ['manjericao', -0.5],
  ['gengibre', -0.3],
  ['lavanda', -0.2],
  ['vetiver', 0],
  ['cedro', 0.2],
  ['sandalo', 0.4],
  ['patchouli', 0.5],
  ['cravo', 0.6],
  ['canela', 0.8],
  ['cardamomo', 0.1],
  ['fava tonka', 0.9],
  ['baunilha', 0.9],
  ['ambar', 0.9],
  ['benjoim', 0.9],
  ['labdano', 0.8],
  ['incenso', 0.8],
  ['olibano', 0.7],
  ['mirra', 0.8],
  ['oud', 1],
  ['agarwood', 1],
  ['tabaco', 0.9],
  ['couro', 0.8],
  ['chocolate', 1],
  ['cacau', 0.9],
  ['cafe', 0.8],
  ['caramelo', 1],
  ['praline', 1],
  ['mel', 0.8],
  ['rum', 0.8],
  ['conhaque', 0.8],
];

export interface OlfactoryProfile {
  /** -1 = muito fresco, +1 = muito quente. */
  warmth: number;
  /** Termos que pesaram mais, para explicar o resultado. */
  drivers: string[];
}

/** O termo precisa começar uma palavra ("vermelha" não conta como "mel"). */
const NOTE_PATTERNS = NOTE_WARMTH.map(([key, v]) => [new RegExp(`(^|[\\s'(-])${key}`), v] as const);

function noteWarmth(note: string): number | undefined {
  const n = normalize(note);
  for (const [re, v] of NOTE_PATTERNS) if (re.test(n)) return v;
  return undefined;
}

const cache = new WeakMap<Perfume, OlfactoryProfile | null>();

export function olfactoryProfile(p: Perfume): OlfactoryProfile | undefined {
  const hit = cache.get(p);
  if (hit !== undefined) return hit ?? undefined;

  const items: { label: string; value: number; weight: number }[] = [];
  // Acordes valem mais e os primeiros (dominantes) pesam mais que os últimos.
  (p.accords ?? []).forEach((a, i) => {
    const v = ACCORD_WARMTH[normalize(a)];
    if (v !== undefined) items.push({ label: a, value: v, weight: 2 / (1 + i * 0.3) });
  });
  const tiers: [string[], number][] = [
    [p.topNotes, 0.6],
    [p.heartNotes, 0.8],
    [p.baseNotes, 1],
  ];
  for (const [notes, w] of tiers) {
    for (const n of notes) {
      const v = noteWarmth(n);
      if (v !== undefined) items.push({ label: n, value: v, weight: w });
    }
  }

  let result: OlfactoryProfile | null = null;
  if (items.length >= 2) {
    const total = items.reduce((s, x) => s + x.weight, 0);
    const warmth = items.reduce((s, x) => s + x.value * x.weight, 0) / total;
    const sign = Math.sign(warmth) || 1;
    const drivers = items
      .filter((x) => Math.sign(x.value) === sign && x.value !== 0)
      .sort((a, b) => b.weight * Math.abs(b.value) - a.weight * Math.abs(a.value))
      .map((x) => x.label.toLowerCase())
      .filter((v, i, all) => all.indexOf(v) === i)
      .slice(0, 3);
    result = { warmth, drivers };
  }
  cache.set(p, result);
  return result ?? undefined;
}

export function describeWarmth(w: number): string {
  if (w <= -0.5) return 'fresco';
  if (w <= -0.15) return 'levemente fresco';
  if (w < 0.15) return 'equilibrado';
  if (w < 0.5) return 'levemente quente';
  return 'quente e envolvente';
}

/** Perfil ideal para a sensação térmica: 34 °C → -1 (fresco), 22 °C → 0, 10 °C → +1 (quente). */
export function idealWarmth(tempC: number): number {
  return Math.max(-1, Math.min(1, (22 - tempC) / 12));
}

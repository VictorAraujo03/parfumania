import { FAMILIES, labelOf } from '../../data/options';
import { describeWarmth, olfactoryProfile } from '../../services/recommendations/profile';
import type { ScentoOccasion } from '../../services/scento/scento';
import type { CatalogEntry, ClimateThresholds, Occasion, Perfume, Settings, UsageLog } from '../../types';
import { normalize, perfumeKey } from '../../utils/text';

/**
 * "O que falta na sua coleção": verifica quais MOMENTOS sua coleção cobre
 * (calor, frio, trabalho, treino, encontro, festa, passeio) e sugere perfumes
 * com nome para os que faltam.
 *
 * Um perfume cobre um momento quando VOCÊ o marcou para isso ou, na falta de
 * marcação, quando o perfil dos acordes/notas cadastrados indica (heurística
 * de perfumaria, sempre identificada como tal). A importância de cada momento
 * vem do clima de agora e dos seus registros de uso. Nada é inventado: sem
 * dados, o perfume simplesmente não conta.
 */

export type SlotId = 'heat' | 'cold' | 'work' | 'gym' | 'date' | 'party' | 'casual';

interface SlotDef {
  id: SlotId;
  /** "dias quentes" — usado em frases. */
  label: string;
  /** "Um perfume para dias quentes". */
  title: string;
  /** O que procurar, em linguagem simples. */
  wanted: string;
  occasions: Occasion[];
  scento: ScentoOccasion;
  /** Cobertura pelo que o usuário marcou. */
  tagged(p: Perfume): boolean;
  /** Cobertura pelo perfil (warmth de -1 fresco a +1 quente) e projeção. */
  fits(warmth: number, projection?: number): boolean;
  baseWeight: number;
}

const SLOTS: SlotDef[] = [
  {
    id: 'heat',
    label: 'dias quentes',
    title: 'Um perfume para dias quentes',
    wanted: 'cítricos, aquáticos ou verdes, de projeção leve',
    occasions: [],
    scento: 'summer-days',
    tagged: (p) => p.climates.includes('hot'),
    fits: (w, proj) => w <= -0.35 && (proj ?? 3) <= 4,
    baseWeight: 1.2,
  },
  {
    id: 'cold',
    label: 'dias frios',
    title: 'Um perfume para dias frios',
    wanted: 'ambarados, baunilhados, especiados ou resinosos',
    occasions: [],
    scento: 'cold-weather',
    tagged: (p) => p.climates.includes('cold'),
    fits: (w) => w >= 0.45,
    baseWeight: 0.8,
  },
  {
    id: 'work',
    label: 'o trabalho',
    title: 'Um perfume para o trabalho',
    wanted: 'limpos e discretos, que não incomodem em ambiente fechado',
    occasions: ['work'],
    scento: 'office',
    tagged: (p) => p.occasions.includes('work'),
    fits: (w, proj) => Math.abs(w) <= 0.45 && (proj ?? 3) <= 3,
    baseWeight: 1,
  },
  {
    id: 'gym',
    label: 'treinar',
    title: 'Um perfume para treinar',
    wanted: 'bem frescos e leves, que não enjoem com o calor do corpo',
    occasions: ['sport'],
    scento: 'workout',
    tagged: (p) => p.occasions.includes('sport'),
    fits: (w, proj) => w <= -0.55 && (proj ?? 3) <= 3,
    baseWeight: 0.5,
  },
  {
    id: 'date',
    label: 'encontros',
    title: 'Um perfume para encontros',
    wanted: 'envolventes e próximos à pele: doces, ambarados ou florais quentes',
    occasions: ['date'],
    scento: 'date-night',
    tagged: (p) => p.occasions.includes('date'),
    fits: (w, proj) => w >= 0.3 && (proj ?? 3) <= 4,
    baseWeight: 0.9,
  },
  {
    id: 'party',
    label: 'festas e noites fora',
    title: 'Um perfume para festas',
    wanted: 'marcantes, com boa projeção e fixação',
    occasions: ['party'],
    scento: 'night-out',
    tagged: (p) => p.occasions.includes('party'),
    fits: (w, proj) => w >= 0.5 && (proj ?? 4) >= 4,
    baseWeight: 0.8,
  },
  {
    id: 'casual',
    label: 'passeios e o dia a dia',
    title: 'Um perfume para passear',
    wanted: 'versáteis e luminosos, fáceis de usar a qualquer hora',
    occasions: ['casual', 'daily', 'travel'],
    scento: 'weekend',
    tagged: (p) => p.occasions.some((o) => o === 'casual' || o === 'daily' || o === 'travel'),
    fits: (w) => w >= -0.6 && w <= 0.15,
    baseWeight: 0.9,
  },
];

export interface CatalogPick {
  entry: CatalogEntry;
  /** Por que esta sugestão (perfil + semelhança com o seu gosto). */
  reasons: string[];
  score: number;
}

export interface SlotResult {
  id: SlotId;
  label: string;
  title: string;
  wanted: string;
  scento: ScentoOccasion;
  /** Perfumes da coleção que cobrem o momento. */
  have: Perfume[];
  /** Quantos foram contados só pelo perfil (sem marcação sua). */
  inferred: number;
  importance: number;
  /** Frase explicando por que é uma lacuna (ou ponto forte). */
  why: string;
  picks: CatalogPick[];
}

export interface CollectionReport {
  analyzed: number;
  logs: number;
  /** Frase de abertura: "Analisamos seus 27 perfumes…". */
  headline: string;
  strengths: SlotResult[];
  gaps: SlotResult[];
  /** Perfumes sem nenhum dado útil (sem marcações nem acordes/notas). */
  withoutData: Perfume[];
}

export interface CoverageInput {
  perfumes: Perfume[];
  logs: UsageLog[];
  catalog: CatalogEntry[];
  settings: Pick<Settings, 'favoriteFamilies' | 'dislikedFamilies' | 'frequentOccasions'>;
  thresholds: ClimateThresholds;
  weather?: { temperatureC?: number; locationName?: string };
  fmtTemp?: (c: number) => string;
  /** false = só a análise, sem procurar sugestões no catálogo (mais leve, para o painel). */
  suggest?: boolean;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function joinPt(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** "o Acqua di Giò", "o Sauvage e o Bleu" — até 3 nomes. */
function names(list: Perfume[]): string {
  const shown = list.slice(0, 3).map((p) => p.name);
  const rest = list.length - shown.length;
  return joinPt(rest > 0 ? [...shown, `mais ${rest}`] : shown);
}

/** Gosto do usuário: peso de cada acorde nos perfumes que ele mais usa, ama e avalia bem. */
function tasteProfile(owned: Perfume[], logs: UsageLog[]): Map<string, number> {
  const uses = new Map<string, number>();
  for (const l of logs) uses.set(l.perfumeId, (uses.get(l.perfumeId) ?? 0) + 1);
  const taste = new Map<string, number>();
  for (const p of owned) {
    const w = 1 + (p.favorite ? 1.5 : 0) + (p.rating ? (p.rating - 3) * 0.5 : 0) + Math.min(2, (uses.get(p.id) ?? 0) * 0.25);
    if (w <= 0) continue;
    (p.accords ?? []).slice(0, 5).forEach((a, i) => {
      const k = normalize(a);
      taste.set(k, (taste.get(k) ?? 0) + w / (1 + i * 0.3));
    });
  }
  return taste;
}

/** Itens do catálogo considerados (os mais populares com acordes, por desempenho). */
const CATALOG_POOL = 4000;
const poolCache = new WeakMap<CatalogEntry[], CatalogEntry[]>();

function catalogPool(catalog: CatalogEntry[]): CatalogEntry[] {
  const hit = poolCache.get(catalog);
  if (hit) return hit;
  const pool = catalog
    .filter((e) => (e.accords?.length ?? 0) >= 2 && (!e.concentration || e.concentration !== 'other'))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, CATALOG_POOL);
  poolCache.set(catalog, pool);
  return pool;
}

export function analyzeCoverage(input: CoverageInput): CollectionReport {
  const { perfumes, logs, catalog, settings, thresholds, weather } = input;
  const fmt = input.fmtTemp ?? ((c: number) => `${Math.round(c)}°C`);
  const owned = perfumes.filter((p) => p.status === 'owned' || p.status === 'decant');
  const ownedIds = new Set(owned.map((p) => p.id));
  const ownLogs = logs.filter((l) => ownedIds.has(l.perfumeId));

  // Uso real por ocasião (registros) + ocasiões frequentes das configurações.
  const occCount = new Map<Occasion, number>();
  for (const l of ownLogs) if (l.occasion) occCount.set(l.occasion, (occCount.get(l.occasion) ?? 0) + 1);
  const withOccasion = [...occCount.values()].reduce((a, b) => a + b, 0);
  const temp = weather?.temperatureC;

  const results: SlotResult[] = SLOTS.map((slot) => {
    let inferred = 0;
    const have = owned.filter((p) => {
      if (slot.tagged(p)) return true;
      const prof = olfactoryProfile(p);
      if (prof && slot.fits(prof.warmth, p.projection ?? p.intensity)) {
        inferred++;
        return true;
      }
      return false;
    });

    let importance = slot.baseWeight;
    const usedShare = withOccasion ? slot.occasions.reduce((s, o) => s + (occCount.get(o) ?? 0), 0) / withOccasion : 0;
    importance += usedShare * 2;
    if (slot.occasions.some((o) => settings.frequentOccasions.includes(o))) importance += 0.6;
    if (temp !== undefined) {
      if (slot.id === 'heat' && temp >= thresholds.hotMinC) importance += 1;
      if (slot.id === 'cold' && temp < thresholds.coldMaxC) importance += 1;
      if (slot.id === 'cold' && temp >= thresholds.hotMinC) importance -= 0.3;
    }

    const where = weather?.locationName ? ` em ${weather.locationName}` : '';
    const weatherNote =
      temp !== undefined && slot.id === 'heat' && temp >= thresholds.hotMinC
        ? ` — e agora faz ${fmt(temp)}${where}`
        : temp !== undefined && slot.id === 'cold' && temp < thresholds.coldMaxC
          ? ` — e agora faz ${fmt(temp)}${where}`
          : '';
    const usedNote = usedShare >= 0.15 ? ` Mesmo assim, ${Math.round(usedShare * 100)}% dos seus usos registrados são para ${slot.label}.` : '';
    const why =
      have.length === 0
        ? `Nenhum perfume da coleção cobre ${slot.label}${weatherNote}.${usedNote}`
        : have.length === 1
          ? `Só ${names(have)} cobre ${slot.label}${weatherNote}.${usedNote}`
          : `${cap(names(have))} cobrem ${slot.label}.`;

    return { id: slot.id, label: slot.label, title: slot.title, wanted: slot.wanted, scento: slot.scento, have, inferred, importance, why, picks: [] };
  });

  // Lacunas: momentos com menos de 2 opções, mais importantes primeiro (sem nenhuma opção pesa o dobro).
  const gaps = results
    .filter((r) => r.have.length < 2 && r.importance >= 0.7)
    .sort((a, b) => (b.have.length === 0 ? 2 : 1) * b.importance - (a.have.length === 0 ? 2 : 1) * a.importance);
  const strengths = results.filter((r) => r.have.length >= 3).sort((a, b) => b.have.length - a.have.length);

  // Sugestões com nome a partir do catálogo, sem repetir perfume nem marca entre lacunas.
  const registered = new Set(perfumes.map((p) => perfumeKey(p.brand, p.name)));
  const registeredIds = new Set(perfumes.map((p) => p.catalogId).filter(Boolean));
  const disliked = new Set(settings.dislikedFamilies);
  const favorites = new Set(settings.favoriteFamilies);
  const taste = tasteProfile(owned, ownLogs);
  const tasteMax = Math.max(1, ...taste.values());
  const usedEntries = new Set<string>();
  const pool = catalogPool(catalog);

  for (const gap of input.suggest === false ? [] : gaps) {
    const slot = SLOTS.find((s) => s.id === gap.id)!;
    const brands = new Set<string>();
    const scored = pool
      .filter((e) => !registeredIds.has(e.id) && !registered.has(perfumeKey(e.brand, e.name)) && !usedEntries.has(e.id))
      .filter((e) => !e.family || !disliked.has(e.family))
      .flatMap((e) => {
        const prof = olfactoryProfile(e);
        if (!prof || !slot.fits(prof.warmth)) return [];
        const shared = (e.accords ?? []).filter((a) => taste.has(normalize(a)));
        const affinity = shared.reduce((s, a) => s + (taste.get(normalize(a)) ?? 0), 0) / tasteMax;
        let score = Math.log10((e.popularity ?? 0) + 10) + affinity * 0.8;
        const reasons = [
          `Perfil ${describeWarmth(prof.warmth)}${prof.drivers.length ? ` (${prof.drivers.join(', ')})` : ''}, bom para ${slot.label}.`,
        ];
        if (shared.length) reasons.push(`Tem acordes que você já curte: ${shared.slice(0, 3).map((a) => a.toLowerCase()).join(', ')}.`);
        if (e.family && favorites.has(e.family)) {
          score += 0.6;
          reasons.push(`${labelOf(FAMILIES, e.family)} está entre suas famílias favoritas.`);
        }
        return [{ entry: e, reasons, score }];
      })
      .sort((a, b) => b.score - a.score);
    for (const s of scored) {
      const brand = normalize(s.entry.brand);
      if (brands.has(brand)) continue;
      brands.add(brand);
      usedEntries.add(s.entry.id);
      gap.picks.push(s);
      if (gap.picks.length >= 3) break;
    }
  }

  const withoutData = owned.filter(
    (p) => p.climates.length + p.occasions.length === 0 && !olfactoryProfile(p),
  );

  const usesText = ownLogs.length ? ` e ${ownLogs.length} ${ownLogs.length === 1 ? 'uso registrado' : 'usos registrados'}` : '';
  const strongText = strengths.length
    ? ` Você está bem servido para ${joinPt(strengths.slice(0, 2).map((s) => `${s.label} (${s.have.length})`))}.`
    : '';
  const gapText = gaps.length
    ? ` O que mais falta: ${gaps[0].title.toLowerCase()}${gaps[0].have.length ? ` — hoje só ${names(gaps[0].have)} cobre esse momento` : ''}.`
    : ' Sua coleção cobre bem todos os momentos que analisamos.';
  const headline = `Analisamos seus ${owned.length} ${owned.length === 1 ? 'perfume' : 'perfumes'}${usesText}.${strongText}${gapText}`;

  return { analyzed: owned.length, logs: ownLogs.length, headline, strengths, gaps, withoutData };
}

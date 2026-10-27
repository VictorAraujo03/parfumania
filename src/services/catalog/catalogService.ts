import type { CatalogEntry, Concentration, Occasion, OlfactoryFamily } from '../../types';
import { normalize } from '../../utils/text';

export interface CatalogQuery {
  text?: string;
  family?: OlfactoryFamily;
  concentration?: Concentration;
  occasion?: Occasion;
}

/**
 * Contrato de um provedor de catálogo remoto (API ou base licenciada).
 * Hoje o catálogo é local: entradas de demonstração + base importada pelo
 * usuário (ver hooks/useCatalog.tsx). Uma integração futura deve implementar
 * esta interface e preencher `source`/`verification` de cada item.
 * Não há scraping de sites de terceiros.
 */
export interface CatalogProvider {
  id: string;
  name: string;
  search(query: CatalogQuery, limit: number): Promise<CatalogEntry[]>;
  getById(id: string): Promise<CatalogEntry | undefined>;
}

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  um: '1',
  dois: '2',
  tres: '3',
};

/** Normaliza para busca: sem acentos, pontuação vira espaço, números por extenso viram dígitos. */
export function searchNormalize(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] ?? w)
    .join(' ');
}

export interface IndexedEntry {
  entry: CatalogEntry;
  name: string;
  key: string;
}

export function indexCatalog(entries: CatalogEntry[]): IndexedEntry[] {
  return entries.map((entry) => {
    const name = searchNormalize(entry.name);
    return { entry, name, key: ` ${name} ${searchNormalize(entry.brand)} ` };
  });
}

export function matchesFilters(e: CatalogEntry, q: CatalogQuery): boolean {
  if (q.family && e.family !== q.family) return false;
  if (q.concentration && e.concentration !== q.concentration) return false;
  if (q.occasion && !e.suggestedOccasions.includes(q.occasion)) return false;
  return true;
}

const hasNotes = (e: CatalogEntry) => e.topNotes.length + e.heartNotes.length + e.baseNotes.length > 0;

/**
 * Busca por nome e marca: todas as palavras digitadas precisam aparecer.
 * Ordena por relevância (nome começa com a busca, palavras inteiras),
 * presença de notas e popularidade na fonte.
 */
export function searchCatalog(
  index: IndexedEntry[],
  query: CatalogQuery,
  limit = 50,
): { results: CatalogEntry[]; total: number } {
  const q = searchNormalize(query.text ?? '');
  const tokens = q.split(' ').filter(Boolean);
  const scored: { e: CatalogEntry; score: number }[] = [];

  for (const item of index) {
    if (!matchesFilters(item.entry, query)) continue;
    if (tokens.length && !tokens.every((t) => item.key.includes(t))) continue;
    let score = 0;
    if (q) {
      if (item.name === q) score += 6;
      else if (item.name.startsWith(q)) score += 4;
      else if (item.key.includes(` ${q}`)) score += 2;
      score += tokens.filter((t) => item.key.includes(` ${t} `)).length * 0.5;
    }
    if (hasNotes(item.entry)) score += 1;
    // Pós-barba, body spray etc. ficam abaixo dos perfumes propriamente ditos.
    if (item.entry.concentration === 'other') score -= 1.5;
    score += Math.log10((item.entry.popularity ?? 0) + 1) * 0.6;
    if (item.entry.source.kind === 'demo') score -= 0.3;
    scored.push({ e: item.entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return { results: scored.slice(0, limit).map((s) => s.e), total: scored.length };
}

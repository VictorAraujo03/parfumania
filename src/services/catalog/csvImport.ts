import { translateAccord, translateNote } from '../../data/noteTranslations';
import type { CatalogEntry, Concentration, OlfactoryFamily } from '../../types';
import { parseCsv } from '../../utils/csv';
import { hashString, normalize } from '../../utils/text';

/**
 * Converte um CSV de perfumes em entradas de catálogo.
 *
 * Reconhece automaticamente os cabeçalhos das bases públicas mais comuns
 * (Parfumo/TidyTuesday, Fragrantica/Kaggle) e planilhas próprias com
 * cabeçalhos em português. Nada é inventado: campos ausentes ficam vazios.
 */

type Field =
  | 'number'
  | 'name'
  | 'brand'
  | 'year'
  | 'concentration'
  | 'family'
  | 'top'
  | 'middle'
  | 'base'
  | 'accords'
  | 'perfumers'
  | 'popularity'
  | 'url';

/** Aliases normalizados (minúsculas, sem acento, só letras/números). */
const ALIASES: Record<Field, string[]> = {
  number: ['number'],
  name: ['name', 'perfume', 'perfumename', 'fragrance', 'nome', 'perfumenome'],
  brand: ['brand', 'marca', 'house', 'designer'],
  year: ['releaseyear', 'year', 'ano', 'anolancamento', 'launchyear'],
  concentration: ['concentration', 'concentracao', 'type'],
  family: ['family', 'familia', 'familiaolfativa', 'olfactoryfamily'],
  top: ['topnotes', 'top', 'notasdesaida', 'saida', 'notassaida'],
  middle: ['middlenotes', 'middle', 'heartnotes', 'heart', 'notasdecoracao', 'coracao', 'notascoracao'],
  base: ['basenotes', 'base', 'notasdefundo', 'fundo', 'notasfundo'],
  accords: ['mainaccords', 'accords', 'acordes', 'acordesprincipais'],
  perfumers: ['perfumers', 'perfumer', 'perfumistas', 'perfumista', 'nose'],
  popularity: ['ratingcount', 'votes', 'reviews', 'avaliacoes'],
  url: ['url', 'link'],
};

const key = (h: string) => normalize(h).replace(/[^a-z0-9]/g, '');

export interface ColumnMap {
  index: Partial<Record<Field, number>>;
  /** Colunas numeradas (ex.: mainaccord1..5, Perfumer1..2). */
  accordColumns: number[];
  perfumerColumns: number[];
}

export function mapColumns(header: string[]): ColumnMap {
  const keys = header.map(key);
  const index: ColumnMap['index'] = {};
  (Object.keys(ALIASES) as Field[]).forEach((field) => {
    const i = keys.findIndex((k) => ALIASES[field].includes(k));
    if (i >= 0) index[field] = i;
  });
  return {
    index,
    accordColumns: keys.flatMap((k, i) => (/^mainaccord\d+$/.test(k) ? [i] : [])),
    perfumerColumns: keys.flatMap((k, i) => (/^perfumer\d+$/.test(k) ? [i] : [])),
  };
}

const EMPTY = new Set(['', 'na', 'n/a', 'null', 'none', 'unknown', '-']);
const clean = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return EMPTY.has(t.toLowerCase()) ? '' : t;
};

const splitValues = (v: string) =>
  clean(v)
    .split(/\s*[,;|]\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !EMPTY.has(s.toLowerCase()));

/** "1-million-elixir" → "1 Million Elixir" (bases que exportam slugs). */
function deslug(v: string): string {
  if (/\s/.test(v) || !/[-_]/.test(v) || v !== v.toLowerCase()) return v;
  return v
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Corrige dois defeitos conhecidos da base Parfumo/TidyTuesday:
 * - números iniciais do nome separados em outra coluna ("1" + "Million Elixir");
 * - marca, ano e concentração repetidos no fim do nome ("Sauvage Dior 2015 Eau de Toilette").
 */
export function cleanName(rawName: string, number: string, brand: string, year: string, concentration: string): string {
  const base = deslug(clean(rawName));
  let name = number ? `${number} ${base}`.trim() : base;
  if (!brand) return name;
  const b = escapeRegExp(brand);
  if (normalize(base) === normalize(brand)) {
    // "212" + "Carolina Herrera": o nome real era só o número.
    const stripped = name.replace(new RegExp(`\\s+${b}\\s*$`, 'i'), '').trim();
    return stripped || name;
  }
  // Só remove a marca quando seguida de ano e/ou concentração (padrão do defeito),
  // preservando nomes que terminam legitimamente com a marca ("Le 1940 Bleu de Chanel").
  const tails = [
    year && concentration ? `\\s+${escapeRegExp(year)}\\s+${escapeRegExp(concentration)}` : '',
    year ? `\\s+${escapeRegExp(year)}` : '',
    concentration ? `\\s+${escapeRegExp(concentration)}` : '',
  ].filter(Boolean);
  for (const tail of tails) {
    const stripped = name.replace(new RegExp(`\\s+${b}${tail}\\s*$`, 'i'), '').trim();
    if (stripped !== name && stripped) {
      name = stripped;
      break;
    }
  }
  return name;
}

export function parseConcentration(text: string): { value?: Concentration; label?: string } {
  const t = normalize(text);
  if (!t) return {};
  if (/extrait|extract/.test(t)) return { value: 'extrait' };
  if (/eau de parfum|^edp$/.test(t)) return { value: 'edp' };
  if (/eau de toilette|^edt$/.test(t)) return { value: 'edt' };
  if (/eau de cologne|^edc$|^cologne$/.test(t)) return { value: 'edc' };
  if (/^(parfum|perfume|pure parfum|pure perfume)$/.test(t)) return { value: 'parfum' };
  return { value: 'other', label: text.trim() };
}

/** Família sugerida a partir do primeiro acorde que tem correspondência clara. */
const ACCORD_FAMILY: Record<string, OlfactoryFamily> = {
  woody: 'woody',
  oud: 'woody',
  citrus: 'citrus',
  floral: 'floral',
  'white floral': 'floral',
  'yellow floral': 'floral',
  rose: 'floral',
  fruity: 'fruity',
  tropical: 'fruity',
  oriental: 'amber',
  amber: 'amber',
  resinous: 'amber',
  balsamic: 'amber',
  spicy: 'spicy',
  'warm spicy': 'spicy',
  'fresh spicy': 'spicy',
  'soft spicy': 'spicy',
  gourmand: 'gourmand',
  chypre: 'chypre',
  aquatic: 'aquatic',
  marine: 'aquatic',
  green: 'green',
  leathery: 'leather',
  leather: 'leather',
  powdery: 'powdery',
  'fougère': 'fougere',
  fougere: 'fougere',
  aromatic: 'aromatic',
  lavender: 'aromatic',
  herbal: 'aromatic',
  musky: 'musky',
};

const FAMILY_TEXT: Record<string, OlfactoryFamily> = {
  amadeirado: 'woody',
  woody: 'woody',
  aromatico: 'aromatic',
  aromatic: 'aromatic',
  fougere: 'fougere',
  citrico: 'citrus',
  citrus: 'citrus',
  floral: 'floral',
  frutado: 'fruity',
  fruity: 'fruity',
  ambar: 'amber',
  oriental: 'amber',
  amber: 'amber',
  especiado: 'spicy',
  spicy: 'spicy',
  gourmand: 'gourmand',
  chipre: 'chypre',
  chypre: 'chypre',
  aquatico: 'aquatic',
  aquatic: 'aquatic',
  verde: 'green',
  green: 'green',
  couro: 'leather',
  leather: 'leather',
  almiscarado: 'musky',
  musky: 'musky',
  atalcado: 'powdery',
  powdery: 'powdery',
};

export interface ImportResult {
  entries: CatalogEntry[];
  skipped: number;
  /** Cabeçalhos encontrados, para mensagens de erro. */
  header: string[];
}

export class CatalogImportError extends Error {}

export function importCatalogCsv(text: string, sourceLabel: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new CatalogImportError('O arquivo está vazio ou não é um CSV válido.');
  const header = rows[0];
  const map = mapColumns(header);
  const { index } = map;
  if (index.name === undefined || index.brand === undefined) {
    throw new CatalogImportError(
      `Não encontrei as colunas de nome e marca. Cabeçalhos do arquivo: ${header.slice(0, 15).join(', ')}.`,
    );
  }

  const get = (row: string[], f: Field) => (index[f] === undefined ? '' : clean(row[index[f]!]));
  const seen = new Set<string>();
  const entries: CatalogEntry[] = [];
  let skipped = 0;
  const source = { kind: 'import' as const, label: sourceLabel };

  for (const row of rows.slice(1)) {
    const brand = deslug(get(row, 'brand'));
    const yearText = get(row, 'year');
    const concText = get(row, 'concentration');
    const name = cleanName(get(row, 'name'), get(row, 'number'), brand, yearText, concText);
    if (!name || !brand) {
      skipped++;
      continue;
    }

    const yearNum = Number(yearText);
    const year = Number.isInteger(yearNum) && yearNum >= 1700 && yearNum <= 2100 ? yearNum : undefined;
    const conc = parseConcentration(concText);

    const rawAccords = [
      ...splitValues(get(row, 'accords')),
      ...map.accordColumns.map((i) => clean(row[i])).filter(Boolean),
    ];
    const accords = [...new Set(rawAccords.map(translateAccord))];
    const firstMapped = rawAccords.map((a) => ACCORD_FAMILY[a.toLowerCase()]).find(Boolean);
    const explicitFamily = FAMILY_TEXT[key(get(row, 'family'))];

    const perfumers = [
      ...splitValues(get(row, 'perfumers').replace(/\s+\/\s+[^,]*/g, '')),
      ...map.perfumerColumns.map((i) => deslug(clean(row[i]))).filter(Boolean),
    ];

    const notes = (f: Field) => [...new Set(splitValues(get(row, f)).map(translateNote))];
    const url = get(row, 'url') || undefined;
    const popularity = Number(get(row, 'popularity').replace(/[^\d]/g, '')) || undefined;

    const idBase = url ?? `${brand}|${name}|${yearText}|${concText}`;
    let id = `imp-${hashString(idBase).toString(36)}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);

    entries.push({
      id,
      name,
      brand,
      concentration: conc.value,
      concentrationLabel: conc.label,
      family: explicitFamily ?? firstMapped,
      familyFromAccord: !explicitFamily && !!firstMapped,
      topNotes: notes('top'),
      heartNotes: notes('middle'),
      baseNotes: notes('base'),
      accords: accords.length ? accords : undefined,
      perfumers: perfumers.length ? [...new Set(perfumers)] : undefined,
      year,
      popularity,
      url,
      suggestedOccasions: [],
      source,
      verification: 'unverified',
    });
  }
  return { entries, skipped, header };
}


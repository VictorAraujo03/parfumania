import { translateAccord, translateNote } from '../../data/noteTranslations';

/**
 * "Colar notas": organiza um texto que VOCÊ copiou de uma página de perfume
 * (Fragrantica, Parfumo, site da marca…) em notas de saída, coração, fundo e
 * acordes. Nada é buscado na internet: só o texto colado é lido.
 *
 * Formatos reconhecidos:
 * - pirâmide com títulos ("Top Notes", "Notas de Topo", "Middle Notes", "Coração",
 *   "Base Notes", "Fundo", "Main accords", "Acordes principais");
 * - frase de descrição ("Top notes are X; middle notes are Y; base notes are Z",
 *   "As notas de topo são X; as notas de coração são Y; as notas de fundo são Z");
 * - lista simples ("Notes: X, Y, Z"), que vai para o coração.
 */
export interface PastedNotes {
  top: string[];
  heart: string[];
  base: string[];
  accords: string[];
}

type Section = keyof PastedNotes;

const HEADERS: [Section, RegExp][] = [
  ['top', /^(top notes?|head notes?|notas? de (topo|sa[ií]da|cabe[cç]a)|topo|sa[ií]da)$/i],
  ['heart', /^(middle notes?|heart notes?|notas? de (cora[cç][aã]o|corpo|meio)|cora[cç][aã]o|corpo)$/i],
  ['base', /^(base notes?|notas? de fundo|fundo)$/i],
  ['accords', /^(main accords?|accords?|acordes( principais)?)$/i],
  ['heart', /^(fragrance notes|notes|notas( olfativas)?)$/i],
];

/** Linhas que encerram a seção atual (avaliações, votos, descrição…). */
const STOP = /(rating|vot(e|o|ação|acao)|review|avalia|longevity|sillage|fixa[cç][aã]o|proje[cç][aã]o|pyramid|pir[aâ]mide|description|descri[cç][aã]o|similar|perfumer|perfumista|launched|lançado)/i;

const splitList = (s: string) =>
  s
    .split(/,|;| and | e |\s&\s/i)
    .map((x) => x.replace(/^(the|a|as|os|o)\s+/i, '').replace(/[.:]+$/, '').trim())
    .filter((x) => x.length >= 2 && x.length <= 40 && !/^\d/.test(x));

const uniq = (xs: string[]) => [...new Set(xs)];

function finish(p: PastedNotes): PastedNotes {
  return {
    top: uniq(p.top.map(translateNote)),
    heart: uniq(p.heart.map(translateNote)),
    base: uniq(p.base.map(translateNote)),
    accords: uniq(p.accords.map(translateAccord)),
  };
}

function fromSentence(text: string): PastedNotes | undefined {
  const flat = text.replace(/\s+/g, ' ');
  const en = /top notes? (?:are|is|include) (.+?);\s*(?:the )?(?:middle|heart) notes? (?:are|is|include) (.+?);\s*(?:and )?(?:the )?base notes? (?:are|is|include) (.+?)(?:\.|$)/i.exec(flat);
  const pt = /notas? de (?:topo|sa[ií]da|cabe[cç]a) (?:s[aã]o|[ée]) (.+?);\s*(?:as )?notas? de (?:cora[cç][aã]o|corpo|meio) (?:s[aã]o|[ée]) (.+?);\s*(?:e )?(?:as )?notas? de fundo (?:s[aã]o|[ée]) (.+?)(?:\.|$)/i.exec(flat);
  const m = en ?? pt;
  if (m) return { top: splitList(m[1]), heart: splitList(m[2]), base: splitList(m[3]), accords: [] };
  const linear = /(?:^|\.\s)(?:the )?(?:fragrance )?notes? (?:are|is|include)|(?:^|\.\s)as notas (?:s[aã]o)/i.exec(flat);
  if (linear) {
    const rest = flat.slice(linear.index + linear[0].length).split('.')[0];
    const notes = splitList(rest);
    if (notes.length) return { top: [], heart: notes, base: [], accords: [] };
  }
  return undefined;
}

function fromSections(text: string): PastedNotes | undefined {
  const out: PastedNotes = { top: [], heart: [], base: [], accords: [] };
  let current: Section | undefined;
  let any = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // "Top Notes: Bergamot, Pepper" na mesma linha.
    const inline = /^([^:]{3,30}):\s*(.+)$/.exec(line);
    const header = HEADERS.find(([, re]) => re.test((inline ? inline[1] : line).trim()));
    if (header) {
      current = header[0];
      any = true;
      if (inline) out[current].push(...splitList(inline[2]));
      continue;
    }
    if (STOP.test(line) || line.length > 60) {
      current = undefined;
      continue;
    }
    if (!current || /%|^\d+([.,]\d+)?$/.test(line)) continue;
    out[current].push(...splitList(line));
  }
  return any ? out : undefined;
}

export function parsePastedNotes(text: string): PastedNotes {
  const parsed = fromSections(text) ?? fromSentence(text) ?? { top: [], heart: [], base: [], accords: [] };
  return finish(parsed);
}

export const hasNotes = (p: PastedNotes) => p.top.length + p.heart.length + p.base.length + p.accords.length > 0;

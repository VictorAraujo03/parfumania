import { translateNote } from '../../data/noteTranslations';
import { scentoFamily, scentoWord } from './labels';

/**
 * Tradução das frases da Scento para português.
 *
 * A API só responde em inglês, mas as frases seguem modelos fixos
 * ("Warm and spicy with X and Y; …", "Leans more floral, with X added." …).
 * Traduzimos esses modelos com regras locais e a tabela de notas do app —
 * nada é enviado a serviços de tradução. Frases fora dos modelos ficam no
 * original (translated: false), para nunca inventar sentido.
 */
export interface Translated {
  text: string;
  translated: boolean;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Adjetivos das frases (masculino, concordando com "perfume"). */
const ADJ: Record<string, string> = {
  warm: 'quente',
  spicy: 'especiado',
  sweet: 'doce',
  resinous: 'resinoso',
  floral: 'floral',
  amber: 'ambarado',
  herbal: 'herbal',
  woody: 'amadeirado',
  musky: 'almiscarado',
  powdery: 'atalcado',
  citrusy: 'cítrico',
  citrus: 'cítrico',
  fresh: 'fresco',
  creamy: 'cremoso',
  clean: 'limpo',
  earthy: 'terroso',
  smoky: 'defumado',
  leathery: 'acourado',
  green: 'verde',
  salty: 'salgado',
  fruity: 'frutado',
  aquatic: 'aquático',
  gourmand: 'gourmand',
  aromatic: 'aromático',
};

const adj = (w: string) => ADJ[w.toLowerCase()] ?? scentoWord(w);

/** Nota em minúsculas para o meio da frase (nomes próprios de moléculas ficam como estão). */
function note(n: string): string {
  const pt = translateNote(n);
  return pt === cap(n.trim()) && /^[A-Z]/.test(n) ? n.trim() : pt.toLowerCase();
}

/** [a, b, c] → "a, b e c". */
const joinPt = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;

/** "a, b and c" → "a, b e c" (com cada nota traduzida). */
function list(s: string, map: (x: string) => string = note): string {
  return joinPt(s.split(/, | and /).map((x) => x.trim()).filter(Boolean).map(map));
}

/** Final das frases de cada seleção por ocasião. */
const EDIT_TAIL: Record<string, string> = {
  'dense and warm enough to carry through cold air': 'denso e quente o bastante para atravessar o ar frio',
  'warm and close, made for being near someone': 'quente e próximo, feito para estar perto de alguém',
  'easy to wear from morning to evening in most weather': 'fácil de usar da manhã à noite, em quase qualquer clima',
  'easy to like on first meeting, without shouting': 'agrada logo no primeiro encontro, sem exageros',
  'built on base materials that stay on skin for hours': 'construído sobre notas de fundo que ficam horas na pele',
  'bold enough to hold its own late into the night': 'marcante o bastante para aguentar até tarde da noite',
  'polished and close enough for a shared room': 'refinado e discreto o bastante para dividir o ambiente',
  'bright and airy in the heat': 'luminoso e leve no calor',
  'a quieter name that rewards the curious': 'um nome menos conhecido, que recompensa os curiosos',
  'elegant and easy to wear from ceremony to dancing, never heavy in a crowd':
    'elegante e fácil de usar da cerimônia à pista, sem pesar no meio das pessoas',
  'relaxed and bright, made for unhurried days': 'descontraído e luminoso, feito para dias sem pressa',
  'light and fresh, never cloying when you warm up': 'leve e fresco, nunca enjoativo quando você esquenta',
};

const EDIT_HEAD: Record<string, string> = {
  'the office': 'Para o trabalho',
  'every day': 'Para o dia a dia',
  'the weekend': 'Para o fim de semana',
  'a date night': 'Para um encontro',
  'a night out': 'Para uma noite fora',
  'a wedding': 'Para um casamento',
  'first impressions': 'Para a primeira impressão',
  'summer days': 'Para dias de verão',
  'cold weather': 'Para o frio',
  'a workout': 'Para treinar',
  'long wear': 'Para longa duração',
  'something under the radar': 'Para algo fora do radar',
};

/** Final das frases do guarda-roupa. */
const WARDROBE_TAIL: Record<string, string> = {
  'for daylight hours': 'para as horas do dia',
  'for evenings': 'para as noites',
  'for heat and sun': 'para calor e sol',
  'for cold days': 'para dias frios',
  'a change of direction': 'uma mudança de direção',
};

const WARDROBE_ROLE: Record<string, string> = {
  daytime: 'para o dia',
  evening: 'para a noite',
  'warm weather': 'para o calor',
  'cold weather': 'para o frio',
  'a wild card': 'como curinga',
};

/** "A by B, C by D and E by F" → "A (B), C (D) e E (F)". */
const byList = (s: string) => list(s, (x) => x.replace(/^(.+) by (.+)$/, '$1 ($2)'));

const strip = (s: string) => s.trim().replace(/\.$/, '');

type Rule = [RegExp, (...m: string[]) => string | undefined];

const RULES: Rule[] = [
  // Seleção por ocasião: "Warm and spicy with X and Y; <final>."
  [
    /^(\w+)(?: and (\w+))? with (.+?); (.+)$/,
    (a, b, notes, tail) => {
      const t = EDIT_TAIL[strip(tail)];
      return t ? `${cap(adj(a))}${b ? ` e ${adj(b)}` : ''}, com ${list(notes)}; ${t}.` : undefined;
    },
  ],
  // Guarda-roupa: "Shares X and Y with what you love; for evenings."
  [
    /^Shares (.+) with what you love; (.+)$/,
    (notes, tail) => {
      const t = WARDROBE_TAIL[strip(tail)];
      return t ? `Tem ${list(notes)} em comum com o que você ama; ${t}.` : undefined;
    },
  ],
  // Parecidos: "Leans more fruity and spicy, with guava and cumin added."
  [
    /^Leans more (\w+)(?: and (\w+))?, with (.+) added\.?$/,
    (a, b, notes) => `Puxa mais para o ${adj(a)}${b ? ` e ${adj(b)}` : ''}, com ${list(notes)} a mais.`,
  ],
  [/^Adds (.+) to a similar frame\.?$/, (notes) => `Acrescenta ${list(notes)} a uma estrutura parecida.`],
  // Perfil: "<Nome> by <Marca> (2007) belongs to Scento’s X family, built on a, b and c."
  [
    /^(.+?) by (.+?)(?: \((\d{4})\))? belongs to Scento[’'`]s (.+?) family, built on (.+)$/,
    (name, house, year, fam, notes) =>
      `${name}, de ${house}${year ? ` (${year})` : ''}, é da família ${scentoFamily(fam)} da Scento, construído sobre ${list(strip(notes))}.`,
  ],
  // Perfil com pirâmide: "…family: a and b open onto c, settling on d."
  [
    /^(.+?) by (.+?)(?: \((\d{4})\))? belongs to Scento[’'`]s (.+?) family: (.+?) opens? onto (.+?)(?:, settling on (.+))?$/,
    (name, house, year, fam, top, heart, base) =>
      `${name}, de ${house}${year ? ` (${year})` : ''}, é da família ${scentoFamily(fam)} da Scento: ${list(top)} abrem para ${list(
        base ? heart : strip(heart),
      )}${base ? `, assentando em ${list(strip(base))}` : ''}.`,
  ],
  // Parecidos (resumo): "87 perfumes share structure with X by Y; the closest is Z, sharing a and b."
  [
    /^(\d+) perfumes share structure with (.+?) by (.+?); the closest is (.+?), sharing (.+)$/,
    (n, name, house, closest, notes) =>
      `${n} perfumes têm estrutura parecida com ${name} (${house}); o mais próximo é ${closest}, com ${list(strip(notes))} em comum.`,
  ],
  // Ocasião (resumo): "For the office, A by B, … lead an edit of 8: <final>."
  [
    /^For (.+?), (.+) lead an edit of (\d+): (.+)$/,
    (head, names, n, tail) => {
      const h = EDIT_HEAD[head];
      const t = EDIT_TAIL[strip(tail)];
      return h && t ? `${h}, ${byList(names)} encabeçam uma seleção de ${n}: ${t}.` : undefined;
    },
  ],
  // Guarda-roupa (resumo): "Built around A and B: X for daytime, Y for evening, …."
  [
    /^Built around (.+?): (.+)$/,
    (loves, items) => {
      const parts = strip(items).split(', ').map((it) => {
        const m = /^(.+) for (daytime|evening|warm weather|cold weather|a wild card)$/.exec(it);
        return m ? `${m[1]} ${WARDROBE_ROLE[m[2]]}` : undefined;
      });
      if (parts.some((p) => p === undefined)) return undefined;
      return `Montado em torno de ${list(loves, (x) => x)}: ${joinPt(parts as string[])}.`;
    },
  ],
];

export function translateScento(text: string | null | undefined): Translated {
  const src = (text ?? '').trim();
  for (const [re, fn] of RULES) {
    const m = re.exec(src);
    if (!m) continue;
    const out = fn(...m.slice(1));
    if (out) return { text: out, translated: true };
  }
  return { text: src, translated: false };
}

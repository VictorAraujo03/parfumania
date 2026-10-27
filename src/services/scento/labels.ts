import { translateNote } from '../../data/noteTranslations';
import type { Occasion } from '../../types';
import type { ScentoLean, ScentoOccasion } from './scento';

/**
 * Rótulos em português para os termos da Scento. As frases descritivas
 * (lede, "why", "difference") ficam no original, em inglês: a API não
 * oferece português e não traduzimos automaticamente o texto deles.
 */

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Famílias próprias da Scento (nomes autorais; tradução livre). */
const FAMILY_PT: Record<string, string> = {
  'sunlit citrus': 'Cítrico solar',
  'orchard fruit': 'Frutas de pomar',
  'green leaf': 'Folhas verdes',
  'petal garden': 'Jardim de pétalas',
  'white bloom': 'Flores brancas',
  'powder veil': 'Véu atalcado',
  'spice route': 'Rota das especiarias',
  'wood & root': 'Madeiras e raízes',
  'smoke & leather': 'Fumaça e couro',
  'amber & resin': 'Âmbar e resinas',
  'velvet sweet': 'Doce aveludado',
  'skin musk': 'Almíscar de pele',
  'salt & mineral': 'Sal e minerais',
  'oud court': 'Oud',
};

export function scentoFamily(name: string | null | undefined): string {
  if (!name) return '';
  return FAMILY_PT[name.toLowerCase()] ?? name;
}

const SEASON_PT: Record<string, string> = { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', fall: 'Outono', winter: 'Inverno' };
const HOUR_PT: Record<string, string> = { day: 'Dia', daytime: 'Dia', evening: 'Noite', night: 'Madrugada' };

export const scentoSeason = (s: string) => SEASON_PT[s.toLowerCase()] ?? cap(s);
export const scentoHour = (s: string) => HOUR_PT[s.toLowerCase()] ?? cap(s);

const WORD_PT: Record<string, string> = {
  sweet: 'doce',
  warm: 'quente',
  fresh: 'fresco',
  herbal: 'herbal',
  citrusy: 'cítrico',
  citrus: 'cítrico',
  spicy: 'especiado',
  amber: 'ambarado',
  ambery: 'ambarado',
  woody: 'amadeirado',
  floral: 'floral',
  earthy: 'terroso',
  powdery: 'atalcado',
  green: 'verde',
  fruity: 'frutado',
  musky: 'almiscarado',
  smoky: 'defumado',
  leathery: 'couro',
  creamy: 'cremoso',
  aquatic: 'aquático',
  marine: 'marinho',
  salty: 'salgado',
  clean: 'limpo',
  soapy: 'de sabonete',
  gourmand: 'gourmand',
  resinous: 'resinoso',
  balsamic: 'balsâmico',
  aromatic: 'aromático',
  mineral: 'mineral',
  boozy: 'licoroso',
  animalic: 'animálico',
  ozonic: 'ozônico',
  tropical: 'tropical',
  mossy: 'musgoso',
  bitter: 'amargo',
  metallic: 'metálico',
  rosy: 'rosado',
  soft: 'suave',
  dark: 'escuro',
  bright: 'luminoso',
  light: 'leve',
  rich: 'encorpado',
  dry: 'seco',
  smooth: 'macio',
  juicy: 'suculento',
  airy: 'aéreo',
  cool: 'frio',
  sharp: 'marcante',
  milky: 'lácteo',
  nutty: 'amendoado',
  incense: 'incensado',
  oud: 'oud',
  vanilla: 'baunilhado',
  tea: 'chá',
};

export const scentoWord = (w: string) => WORD_PT[w.toLowerCase()] ?? w.toLowerCase();

/** Notas e ingredientes: usa a tabela de tradução já existente. */
export const scentoNote = (n: string) => translateNote(n);

const ROLE_PT: Record<string, string> = {
  daytime: 'Para o dia',
  day: 'Para o dia',
  evening: 'Para a noite',
  night: 'Para a noite',
  'warm weather': 'Para o calor',
  'cold weather': 'Para o frio',
  signature: 'Assinatura',
  office: 'Para o trabalho',
  weekend: 'Fim de semana',
  'special occasion': 'Ocasiões especiais',
  'wild card': 'Curinga',
};

export const scentoRole = (r: string) => ROLE_PT[r.toLowerCase()] ?? cap(r);

export const SCENTO_OCCASIONS: { value: ScentoOccasion; label: string; ours?: Occasion }[] = [
  { value: 'office', label: 'Trabalho', ours: 'work' },
  { value: 'everyday', label: 'Dia a dia', ours: 'daily' },
  { value: 'weekend', label: 'Fim de semana', ours: 'casual' },
  { value: 'date-night', label: 'Encontro', ours: 'date' },
  { value: 'night-out', label: 'Noite fora', ours: 'party' },
  { value: 'wedding', label: 'Casamento', ours: 'formal' },
  { value: 'first-impressions', label: 'Primeira impressão' },
  { value: 'summer-days', label: 'Verão' },
  { value: 'cold-weather', label: 'Frio' },
  { value: 'workout', label: 'Academia', ours: 'sport' },
  { value: 'long-lasting', label: 'Longa duração' },
  { value: 'under-the-radar', label: 'Discreto' },
];

export const SCENTO_LEANS: { value: ScentoLean; label: string }[] = [
  { value: 'masculine', label: 'Masculino' },
  { value: 'feminine', label: 'Feminino' },
  { value: 'shared', label: 'Compartilhado' },
];

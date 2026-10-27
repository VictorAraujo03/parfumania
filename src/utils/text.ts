/** Normaliza texto para buscas e comparações (sem acentos, minúsculo). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Chave para identificar a mesma fragrância (marca + nome). */
export function perfumeKey(brand: string, name: string): string {
  return `${normalize(brand)}::${normalize(name).replace(/[^a-z0-9]+/g, ' ').trim()}`;
}

/** Converte "a, b; c" em ["a", "b", "c"]. */
export function splitList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

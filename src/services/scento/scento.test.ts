import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveScento, slugFromPage } from './scento';

const match = (name: string, house: string, slug: string) => ({
  kind: 'perfume',
  name,
  house,
  family: 'Sunlit Citrus',
  page: `https://www.scento.com/perfumes/${slug}`,
});

function mockSearch(byQuery: Record<string, unknown[]>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const q = new URL(url).searchParams.get('q') ?? '';
      const matches = byQuery[q] ?? [];
      const body = { folio: 'perfume-search', lede: '', detail: { matches }, scento_page: { label: '', url: '' }, cite: '', continuation: null };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Scento: encontrar o perfume certo', () => {
  it('escolhe sozinho quando nome e marca batem exatamente', async () => {
    mockSearch({
      Sauvage: [match('Sauvage Elixir', 'Dior', 'sauvage-elixir-by-dior'), match('Sauvage', 'Dior', 'sauvage-dior'), match('Sauvage Eau de Parfum', 'Dior', 'sauvage-eau-de-parfum-dior')],
    });
    const r = await resolveScento('Sauvage', 'Dior');
    expect(r.slug).toBe('sauvage-dior');
  });

  it('pede confirmação quando o nome não é idêntico', async () => {
    mockSearch({
      'One Million': [match('1 Million', 'Rabanne', 'rabanne-1-million-toilette'), match('The One', 'Dolce&Gabbana', 'dolce-gabbana-the-one')],
    });
    const r = await resolveScento('One Million', 'Paco Rabanne');
    expect(r.slug).toBeUndefined();
    expect(r.candidates[0].name).toBe('1 Million');
  });

  it('não confunde perfumes de outra marca', async () => {
    mockSearch({ Code: [match('Code', 'Outra Marca', 'outra-code')], 'Giorgio Armani Code': [] });
    const r = await resolveScento('Code', 'Giorgio Armani');
    expect(r.slug).toBeUndefined();
  });

  it('extrai o slug da página do perfume', () => {
    expect(slugFromPage('https://www.scento.com/perfumes/layton-parfums-de-marly')).toBe('layton-parfums-de-marly');
    expect(slugFromPage('https://www.scento.com/brand/armaf')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { decodeText, parseCsv } from '../../utils/csv';
import { indexCatalog, searchCatalog } from './catalogService';
import { cleanName, importCatalogCsv, parseConcentration } from './csvImport';

// Trechos no formato da base Parfumo/TidyTuesday (inclui os defeitos reais de nome).
const PARFUMO = `Number,Name,Brand,Release_Year,Concentration,Rating_Value,Rating_Count,Main_Accords,Top_Notes,Middle_Notes,Base_Notes,Perfumers,URL
1,Million Elixir,Paco Rabanne,2022,NA,7.7,390,"Sweet, Fruity, Synthetic, Floral, Spicy","Apple, Davana","Tonka bean, Turkish rose, Osmanthus","Davana, Vanilla, Cedarwood, Patchouli","Christophe Raynaud, Quentin Bisch",https://www.parfumo.com/Perfumes/Paco_Rabanne/1-million-elixir
1,Million Golden Oud,Paco Rabanne,2023,NA,8.1,85,"Spicy, Oriental, Woody, Sweet, Leathery","Bergamot, Black pepper, Nutmeg, Saffron","Gurjum balsam, Patchouli, Sandalwood","Cedarwood, Cistus, Leather, Oud",NA,https://www.parfumo.com/Perfumes/Paco_Rabanne/1-million-golden-oud
NA,Sauvage Dior 2015 Eau de Toilette,Dior,2015,Eau de Toilette,NA,NA,NA,NA,NA,NA,NA,https://www.parfumo.com/Perfumes/Dior/Sauvage
NA,Sauvage Dior 2015 Lotion Après-Rasage,Dior,2015,Lotion Après-Rasage,NA,21,NA,NA,NA,NA,NA,https://www.parfumo.com/Perfumes/Dior/sauvage-lotion
212,Carolina Herrera,Carolina Herrera,1997,NA,NA,108,NA,NA,NA,NA,NA,https://www.parfumo.com/Perfumes/Carolina_Herrera/212
455,Tabac Écarlate,Le Ré Noir,NA,NA,NA,NA,NA,NA,NA,NA,Valery Sokolov / Валерий Соколов,https://www.parfumo.com/Perfumes/Le_Re_Noir/455-tabac-ecarlate
NA,,Sem Nome,NA,NA,NA,NA,NA,NA,NA,NA,NA,NA`;

describe('importação de base CSV', () => {
  it('lê o formato Parfumo e corrige nomes quebrados', () => {
    const { entries, skipped } = importCatalogCsv(PARFUMO, 'Parfumo');
    expect(skipped).toBe(1);
    const names = entries.map((e) => `${e.name} | ${e.brand}`);
    expect(names).toContain('1 Million Elixir | Paco Rabanne');
    expect(names).toContain('Sauvage | Dior');
    expect(names).toContain('212 | Carolina Herrera');
    expect(names).toContain('455 Tabac Écarlate | Le Ré Noir');
  });

  it('preenche notas traduzidas, acordes, ano, perfumistas e concentração', () => {
    const { entries } = importCatalogCsv(PARFUMO, 'Parfumo');
    const elixir = entries.find((e) => e.name === '1 Million Elixir')!;
    expect(elixir.year).toBe(2022);
    expect(elixir.topNotes).toEqual(['Maçã', 'Davana']);
    expect(elixir.heartNotes).toContain('Rosa turca');
    expect(elixir.perfumers).toEqual(['Christophe Raynaud', 'Quentin Bisch']);
    expect(elixir.accords?.[0]).toBe('Doce');
    // "Sweet" não mapeia família; o primeiro acorde mapeável é "Fruity".
    expect(elixir.family).toBe('fruity');
    expect(elixir.familyFromAccord).toBe(true);

    const sauvage = entries.find((e) => e.name === 'Sauvage' && e.concentration === 'edt');
    expect(sauvage?.topNotes).toEqual([]);
    const lotion = entries.find((e) => e.concentration === 'other');
    expect(lotion?.concentrationLabel).toBe('Lotion Après-Rasage');

    const tabac = entries.find((e) => e.brand === 'Le Ré Noir');
    expect(tabac?.perfumers).toEqual(['Valery Sokolov']);
  });

  it('lê o formato Fragrantica/Kaggle (ponto e vírgula, Latin-1, slugs, acordes numerados)', () => {
    const csv =
      'url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5\n' +
      'https://x/1;1-million;paco-rabanne;France;men;3,95;20000;2008;grapefruit, mint, blood mandarin;rose, cinnamon, spicy notes;leather, amber, woody notes, patchouli;christophe-raynaud;olivier-pescheux;warm spicy;leather;sweet;amber;woody\n';
    const bytes = new Uint8Array([...csv].map((c) => c.charCodeAt(0)));
    const text = decodeText(bytes.buffer);
    const { entries } = importCatalogCsv(text, 'Kaggle');
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.name).toBe('1 Million');
    expect(e.brand).toBe('Paco Rabanne');
    expect(e.topNotes).toEqual(['Toranja', 'Hortelã', 'Blood mandarin']);
    expect(e.accords).toEqual(['Especiado quente', 'Couro', 'Doce', 'Âmbar', 'Amadeirado']);
    expect(e.family).toBe('spicy');
    expect(e.perfumers).toEqual(['Christophe Raynaud', 'Olivier Pescheux']);
    expect(e.popularity).toBe(20000);
  });

  it('aceita cabeçalhos em português', () => {
    const { entries } = importCatalogCsv('nome,marca,família olfativa,notas de saída\nKaiak,Natura,Aromático,"Limão, Hortelã"', 'Minha planilha');
    expect(entries[0]).toMatchObject({ name: 'Kaiak', brand: 'Natura', family: 'aromatic', familyFromAccord: false });
    expect(entries[0].topNotes).toEqual(['Limão', 'Hortelã']);
  });

  it('recusa arquivos sem colunas de nome e marca', () => {
    expect(() => importCatalogCsv('a,b\n1,2', 'x')).toThrow(/nome e marca/);
  });

  it('interpreta concentrações', () => {
    expect(parseConcentration('Eau de Parfum').value).toBe('edp');
    expect(parseConcentration('Extrait de Parfum').value).toBe('extrait');
    expect(parseConcentration('Parfum').value).toBe('parfum');
    expect(parseConcentration('Body Spray')).toEqual({ value: 'other', label: 'Body Spray' });
    expect(cleanName('Bleu de Chanel Chanel 2014 Eau de Parfum', '', 'Chanel', '2014', 'Eau de Parfum')).toBe('Bleu de Chanel');
    expect(cleanName('Bleu de Chanel Chanel 2010 After Shave', '', 'Chanel', '2010', 'After Shave')).toBe('Bleu de Chanel');
    // Marca no fim do nome, sem ano/concentração depois: é parte do nome.
    expect(cleanName('Le 1940 Bleu de Chanel', '', 'Chanel', '1931', '')).toBe('Le 1940 Bleu de Chanel');
  });

  it('encontra "One Million" escrito por extenso e ordena pelo nome', () => {
    const { entries } = importCatalogCsv(PARFUMO, 'Parfumo');
    const { results } = searchCatalog(indexCatalog(entries), { text: 'one million' }, 10);
    expect(results.map((r) => r.name)).toEqual(['1 Million Elixir', '1 Million Golden Oud']);
    expect(searchCatalog(indexCatalog(entries), { text: 'sauvage dior' }).total).toBe(2);
  });

  it('parser CSV lida com aspas e quebras de linha em campos', () => {
    expect(parseCsv('a,b\n"x, ""y""","linha1\nlinha2"')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'linha1\nlinha2'],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { importCatalogCsv } from './csvImport';
import { formatCommunityRating, weightedRating } from './rating';

describe('nota da comunidade', () => {
  it('importa Rating_Value e Rating_Count da base Parfumo', () => {
    const csv = [
      'Number,Name,Brand,Release_Year,Concentration,Rating_Value,Rating_Count,Main_Accords,Top_Notes,Middle_Notes,Base_Notes,Perfumers,URL',
      '1,Sauvage,Dior,2015,Eau de Toilette,7.9,2300,"Fresh, Spicy",Bergamot,Pepper,Ambroxan,François Demachy,https://x/1',
      '2,Raro,Casa,2020,Eau de Parfum,NA,,Woody,,,,,https://x/2',
    ].join('\n');
    const { entries } = importCatalogCsv(csv, 'Teste');
    expect(entries[0].rating).toBe(7.9);
    expect(entries[0].popularity).toBe(2300);
    expect(entries[1].rating).toBeUndefined();
  });

  it('converte bases com nota de 0 a 5 para a escala de 0 a 10', () => {
    const csv = ['Name,Brand,Rating', 'A,X,4.2', 'B,Y,3.5'].join('\n');
    const { entries } = importCatalogCsv(csv, 'Teste');
    expect(entries.map((e) => e.rating)).toEqual([8.4, 7]);
  });

  it('pondera pelos votos: poucos votos puxam para a média geral', () => {
    expect(weightedRating(9.5, 3)!).toBeLessThan(weightedRating(8.2, 5000)!);
    expect(weightedRating(undefined, 100)).toBeUndefined();
  });

  it('formata em português', () => {
    expect(formatCommunityRating(7.9, 2300)).toBe('7,9/10 em 2.300 votos');
    expect(formatCommunityRating(8, 1)).toBe('8,0/10 em 1 voto');
  });
});

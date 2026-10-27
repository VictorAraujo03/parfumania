import type { PerfumeInput } from '../types';
import { DEMO_CATALOG } from './catalog';

/**
 * Perfumes de DEMONSTRAÇÃO carregados na primeira execução.
 * Todos têm `isDemo: true`, aparecem com o selo "Demo" e podem ser editados
 * ou removidos de uma vez em Configurações. As preferências de uso (climas,
 * ocasiões, projeção...) são exemplos ilustrativos, não avaliações reais.
 * Nenhum registro de uso de demonstração é criado: estatísticas são sempre reais.
 */
function fromCatalog(catalogId: string, overrides: Partial<PerfumeInput>): PerfumeInput {
  const c = DEMO_CATALOG.find((e) => e.id === catalogId);
  if (!c) throw new Error(`Entrada de catálogo inexistente: ${catalogId}`);
  return {
    name: c.name,
    brand: c.brand,
    concentration: c.concentration,
    family: c.family,
    topNotes: [...c.topNotes],
    heartNotes: [...c.heartNotes],
    baseNotes: [...c.baseNotes],
    occasions: [],
    climates: [],
    periods: [],
    favorite: false,
    status: 'owned',
    isDemo: true,
    catalogId: c.id,
    dataSource: 'demo',
    ...overrides,
  };
}

export function buildDemoCollection(): PerfumeInput[] {
  return [
    fromCatalog('cat-armani-adg-edt', {
      volumeMl: 100,
      remainingMl: 70,
      occasions: ['daily', 'casual', 'travel'],
      climates: ['hot', 'mild', 'humid'],
      periods: ['morning', 'afternoon'],
      intensity: 3,
      projection: 3,
      longevity: 3,
      rating: 4,
      favorite: true,
    }),
    fromCatalog('cat-hermes-terre-edt', {
      volumeMl: 100,
      remainingMl: 85,
      occasions: ['work', 'daily', 'formal'],
      climates: ['mild', 'cold', 'dry'],
      periods: ['morning', 'afternoon'],
      intensity: 3,
      projection: 2,
      longevity: 4,
      rating: 5,
      favorite: true,
    }),
    fromCatalog('cat-ysl-lanuit-edt', {
      volumeMl: 60,
      remainingMl: 40,
      occasions: ['date', 'party'],
      climates: ['mild', 'cold'],
      periods: ['evening', 'night'],
      intensity: 3,
      projection: 3,
      longevity: 2,
      rating: 4,
    }),
    fromCatalog('cat-tf-tobacco-vanille', {
      volumeMl: 10,
      remainingMl: 6,
      status: 'decant',
      occasions: ['party', 'formal'],
      climates: ['cold'],
      periods: ['evening', 'night'],
      intensity: 5,
      projection: 4,
      longevity: 5,
      rating: 4,
    }),
    // Exemplo intencionalmente incompleto: mostra como o motor reduz a confiança.
    fromCatalog('cat-armani-code-parfum', {
      volumeMl: 75,
    }),
  ];
}

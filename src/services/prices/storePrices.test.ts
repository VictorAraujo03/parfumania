import { describe, expect, it } from 'vitest';
import { matchesPerfume, pickBestOffers, type StoreOffer } from './storePrices';

const offer = (store: string, price: number, title = 'Dior Sauvage Eau de Toilette 100ml'): StoreOffer => ({ store, price, title });

describe('comparação de preços nas lojas', () => {
  it('descarta kits, amostras, outro volume e outro perfume', () => {
    expect(matchesPerfume(offer('Loja', 500), 'Sauvage', 'Dior', 100)).toBe(true);
    expect(matchesPerfume(offer('Loja', 90, 'Kit Dior Sauvage 100ml + Desodorante'), 'Sauvage', 'Dior', 100)).toBe(false);
    expect(matchesPerfume(offer('Loja', 300, 'Dior Sauvage Eau de Toilette 60ml'), 'Sauvage', 'Dior', 100)).toBe(false);
    expect(matchesPerfume(offer('Loja', 400, 'Bleu de Chanel 100ml'), 'Sauvage', 'Dior', 100)).toBe(false);
  });

  it('escolhe as 3 mais baratas, uma por loja, com lojas conhecidas no desempate', () => {
    const offers = [
      offer('Loja X', 520),
      offer('Sephora', 529),
      offer('Loja X', 515),
      offer('Beleza na Web', 560),
      offer('Mercado Livre', 600),
      offer('Usada', 200, 'Dior Sauvage 100ml usado'),
    ];
    offers[5].secondHand = 'usado';
    const best = pickBestOffers(offers, 'Sauvage', 'Dior', 100);
    expect(best.map((o) => o.store)).toEqual(['Sephora', 'Loja X', 'Beleza na Web']);
  });
});

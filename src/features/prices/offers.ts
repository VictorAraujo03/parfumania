import { CONCENTRATION_SHORT, OFFER_CONDITIONS, labelOf } from '../../data/options';
import type { PriceOffer } from '../../types';
import { perfumeKey } from '../../utils/text';

export function offerTotal(o: PriceOffer): number | undefined {
  return o.shipping === undefined ? undefined : o.price + o.shipping;
}

export function pricePerMl(o: PriceOffer): number | undefined {
  const total = offerTotal(o) ?? o.price;
  return o.volumeMl ? total / o.volumeMl : undefined;
}

/** Produtos equivalentes: mesma fragrância, concentração, volume e condição. */
export function equivalenceKey(o: PriceOffer): string {
  return [perfumeKey(o.brand, o.perfumeName), o.concentration ?? '?', o.volumeMl ?? '?', o.condition].join('|');
}

export interface OfferGroup {
  key: string;
  title: string;
  brand: string;
  variant: string;
  offers: PriceOffer[];
  best?: PriceOffer;
}

export type OfferSort = 'total' | 'price' | 'perMl' | 'recent';

function sortValue(o: PriceOffer, sort: OfferSort): number {
  switch (sort) {
    case 'total':
      return offerTotal(o) ?? o.price;
    case 'price':
      return o.price;
    case 'perMl':
      return pricePerMl(o) ?? Number.POSITIVE_INFINITY;
    case 'recent':
      return -Date.parse(o.checkedAt);
  }
}

export function sortOffers(offers: PriceOffer[], sort: OfferSort): PriceOffer[] {
  return [...offers].sort((a, b) => sortValue(a, sort) - sortValue(b, sort));
}

export function groupOffers(offers: PriceOffer[], sort: OfferSort): OfferGroup[] {
  const map = new Map<string, PriceOffer[]>();
  for (const o of offers) {
    const k = equivalenceKey(o);
    map.set(k, [...(map.get(k) ?? []), o]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = sortOffers(list, sort);
      const first = sorted[0];
      const variant = [
        first.concentration ? CONCENTRATION_SHORT[first.concentration] : 'Concentração não informada',
        first.volumeMl ? `${first.volumeMl} ml` : 'volume não informado',
        labelOf(OFFER_CONDITIONS, first.condition),
      ].join(' · ');
      return {
        key,
        title: first.perfumeName,
        brand: first.brand,
        variant,
        offers: sorted,
        best: sortOffers(list, 'total')[0],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

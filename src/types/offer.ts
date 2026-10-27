import type { Concentration } from './perfume';

export type OfferCondition = 'new' | 'tester' | 'used' | 'decant' | 'other';

export interface PriceOffer {
  id: string;
  perfumeName: string;
  brand: string;
  concentration?: Concentration;
  volumeMl?: number;
  condition: OfferCondition;
  store: string;
  price: number;
  /** Frete, quando conhecido. undefined = desconhecido; 0 = grátis. */
  shipping?: number;
  url?: string;
  /** Data e horário em que o preço foi consultado (ISO). */
  checkedAt: string;
  /** Origem da informação: 'manual' (digitada pelo usuário) ou id de um provedor. */
  source: string;
  perfumeId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceOfferInput = Omit<PriceOffer, 'id' | 'createdAt' | 'updatedAt'>;

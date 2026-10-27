import type { PriceOffer } from '../../types';

export interface PriceQuery {
  perfumeName: string;
  brand?: string;
  volumeMl?: number;
}

/**
 * Contrato para integrações futuras com varejistas, programas de afiliados ou
 * fornecedores AUTORIZADOS. Não há scraping de lojas. Provedores que exigem
 * credenciais devem rodar em uma função de servidor, não no navegador.
 */
export interface PriceProvider {
  id: string;
  name: string;
  /** false enquanto não houver integração configurada. */
  active: boolean;
  search(query: PriceQuery): Promise<Omit<PriceOffer, 'id' | 'createdAt' | 'updatedAt'>[]>;
}

/** Nenhuma integração automática está ativa nesta versão. */
export const PRICE_PROVIDERS: PriceProvider[] = [];

export const hasActivePriceIntegration = () => PRICE_PROVIDERS.some((p) => p.active);

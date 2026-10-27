import type { Concentration, Occasion, OlfactoryFamily } from './perfume';

export type VerificationStatus = 'unverified' | 'partial' | 'verified';

export interface CatalogSource {
  kind: 'demo' | 'api' | 'user' | 'import';
  label: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  brand: string;
  concentration?: Concentration;
  family?: OlfactoryFamily;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  /** Ocasiões sugeridas editorialmente; não é uma característica objetiva. */
  suggestedOccasions: Occasion[];
  description?: string;
  /** Ano de lançamento, quando informado pela fonte. */
  year?: number;
  perfumers?: string[];
  /** Acordes principais, em ordem de destaque segundo a fonte. */
  accords?: string[];
  /** Texto original da concentração quando não se encaixa nas opções (ex.: "After Shave"). */
  concentrationLabel?: string;
  /** true quando a família foi deduzida do acorde principal (não informada diretamente). */
  familyFromAccord?: boolean;
  /** Indicador de popularidade na fonte (ex.: número de avaliações), usado só para ordenar buscas. */
  popularity?: number;
  url?: string;
  source: CatalogSource;
  verification: VerificationStatus;
}

export interface ImportedCatalogMeta {
  label: string;
  /** Descrição da origem e da licença conhecida, exibida ao usuário. */
  sourceNote: string;
  importedAt: string;
  count: number;
  withNotes: number;
}

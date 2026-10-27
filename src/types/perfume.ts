export type Concentration = 'edc' | 'edt' | 'edp' | 'parfum' | 'extrait' | 'other';

export type OlfactoryFamily =
  | 'woody'
  | 'aromatic'
  | 'fougere'
  | 'citrus'
  | 'floral'
  | 'fruity'
  | 'amber'
  | 'spicy'
  | 'gourmand'
  | 'chypre'
  | 'aquatic'
  | 'green'
  | 'leather'
  | 'musky'
  | 'powdery'
  | 'other';

export type Occasion =
  | 'work'
  | 'daily'
  | 'date'
  | 'party'
  | 'formal'
  | 'sport'
  | 'casual'
  | 'travel'
  | 'home';

export type Climate = 'hot' | 'mild' | 'cold' | 'humid' | 'dry' | 'rainy';

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export type Environment = 'indoor' | 'outdoor' | 'both';

export type IntensityPreference = 'discreet' | 'moderate' | 'strong';

/** Situação do frasco em relação à coleção do usuário. */
export type PerfumeStatus = 'owned' | 'decant' | 'wishlist' | 'finished' | 'gone';

/** Escala subjetiva de 1 a 5 informada pelo usuário. */
export type Scale = 1 | 2 | 3 | 4 | 5;

export type DataSource = 'manual' | 'catalog' | 'demo';

export interface Perfume {
  id: string;
  name: string;
  brand: string;
  concentration?: Concentration;
  /** Descrição livre quando concentration === 'other'. */
  concentrationOther?: string;
  volumeMl?: number;
  remainingMl?: number;
  family?: OlfactoryFamily;
  /** Ano de lançamento. */
  year?: number;
  perfumers?: string[];
  /** Acordes principais (ex.: Amadeirado, Especiado). */
  accords?: string[];
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  occasions: Occasion[];
  climates: Climate[];
  periods: DayPeriod[];
  intensity?: Scale;
  projection?: Scale;
  /** Fixação observada pelo usuário. */
  longevity?: Scale;
  /** Data no formato YYYY-MM-DD. */
  acquiredAt?: string;
  pricePaid?: number;
  rating?: Scale;
  notes?: string;
  /** Referência para a imagem guardada no IndexedDB. */
  imageId?: string;
  favorite: boolean;
  status: PerfumeStatus;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  catalogId?: string;
  dataSource: DataSource;
}

export type PerfumeInput = Omit<Perfume, 'id' | 'createdAt' | 'updatedAt'>;

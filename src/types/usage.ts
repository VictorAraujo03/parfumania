import type { Environment, Occasion, Scale } from './perfume';
import type { WeatherSnapshot } from './weather';

export interface UsageLog {
  id: string;
  perfumeId: string;
  /** Data e horário da utilização (ISO 8601). */
  usedAt: string;
  occasion?: Occasion;
  environment?: Environment;
  weather?: WeatherSnapshot;
  rating?: Scale;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type UsageLogInput = Omit<UsageLog, 'id' | 'createdAt' | 'updatedAt'>;

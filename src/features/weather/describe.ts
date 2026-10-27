import type { WeatherSnapshot } from '../../types';
import { formatTemperature } from '../../utils/format';

export function describeSnapshot(s: WeatherSnapshot, unit: 'C' | 'F'): string {
  const parts = [
    s.temperatureC !== undefined ? formatTemperature(s.temperatureC, unit) : null,
    s.humidity !== undefined ? `umidade ${s.humidity}%` : null,
    s.precipitationProbability !== undefined ? `chuva ${s.precipitationProbability}%` : null,
    s.description ?? null,
  ].filter(Boolean);
  const origin = s.source === 'manual' ? 'informado manualmente' : s.provider ?? 'API';
  return `${parts.join(', ') || 'sem detalhes'} (${origin})`;
}

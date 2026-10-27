const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatCurrency = (v: number) => currency.format(v);

export function formatTemperature(celsius: number | undefined, unit: 'C' | 'F'): string {
  if (celsius === undefined || Number.isNaN(celsius)) return '—';
  const value = unit === 'F' ? celsius * 1.8 + 32 : celsius;
  return `${Math.round(value)}°${unit}`;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) / 1.8;
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

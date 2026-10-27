import type { Coordinates } from './types';

/**
 * Nome da cidade a partir das coordenadas (BigDataCloud, endpoint gratuito
 * para uso no navegador, sem chave). As coordenadas enviadas já estão
 * arredondadas (~1 km). Em caso de falha, devolve undefined.
 */
const URL_BASE = 'https://api-bdc.io/data/reverse-geocode-client';

interface Response {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  principalSubdivisionCode?: string;
  countryCode?: string;
}

export async function reverseGeocode(coords: Coordinates): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      localityLanguage: 'pt',
    });
    const res = await fetch(`${URL_BASE}?${params}`, { signal: controller.signal });
    if (!res.ok) return undefined;
    const d = (await res.json()) as Response;
    const place = d.locality || d.city;
    if (!place) return undefined;
    // "BR-SP" → "SP" no Brasil; fora dele, o nome do estado/região.
    const region =
      d.countryCode === 'BR' && d.principalSubdivisionCode
        ? d.principalSubdivisionCode.replace(/^BR-/, '')
        : d.principalSubdivision;
    return [place, region].filter(Boolean).join(', ');
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

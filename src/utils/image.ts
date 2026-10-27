export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 900;

export class ImageValidationError extends Error {}

export function validateImageFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError('Formato não suportado. Use JPG, PNG ou WebP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('A imagem deve ter no máximo 5 MB.');
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageValidationError('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

/**
 * Valida, redimensiona e comprime a imagem localmente.
 * Retorna um data URL (WebP quando suportado, JPEG caso contrário).
 */
export async function prepareImage(file: File): Promise<string> {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageValidationError('Seu navegador não permitiu processar a imagem.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

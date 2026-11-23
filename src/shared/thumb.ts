// Miniaturas de fotos subidas (ver /api/thumb). Las fotos externas (R2, enlaces) se dejan igual.
export const THUMB_WIDTHS = [200, 400, 800] as const;

export function thumb(src: string | null | undefined, w: (typeof THUMB_WIDTHS)[number] = 400): string {
  if (!src) return "";
  if (!/^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|avif)$/i.test(src)) return src;
  return `/api/thumb?src=${encodeURIComponent(src)}&w=${w}`;
}

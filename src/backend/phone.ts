// Normalización única de celulares (PIN, WhatsApp, citas). Sin dependencias para evitar importaciones circulares.

/** Deja solo dígitos y agrega 591 a números bolivianos de 8 dígitos. null si no es un celular válido. */
export function normalizePhone(p: unknown): string | null {
  if (typeof p !== "string") return null;
  let d = p.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "591" + d;
  if (d.length < 10 || d.length > 15) return null;
  if (d.startsWith("591") && !/^591[67]\d{7}$/.test(d)) return null; // celulares Bolivia: 6xxxxxxx / 7xxxxxxx
  return d;
}

export function maskPhone(p: string | null | undefined): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  return "•".repeat(Math.max(0, Math.min(5, d.length - 3))) + d.slice(-3);
}

/** true si ambos números son el mismo celular (ignora formato y prefijo 591). */
export function samePhone(a: unknown, b: unknown): boolean {
  const x = normalizePhone(a), y = normalizePhone(b);
  return !!x && x === y;
}

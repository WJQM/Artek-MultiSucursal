// Datos de la empresa que se configuran en Admin → Configuración.
// Seguro para cliente y servidor (sin imports de base de datos).

export const DEFAULT_WARRANTY_DAYS = 30;
export const DEFAULT_ABANDON_DAYS = 90;

/** Términos por defecto de la orden de trabajo cuando la empresa no escribió los suyos */
export function defaultTerms(warrantyDays = DEFAULT_WARRANTY_DAYS, abandonDays = DEFAULT_ABANDON_DAYS): string {
  return [
    "Reparación según diagnóstico aprobado.",
    "El costo puede variar por daños adicionales encontrados.",
    `Garantía de ${warrantyDays} días sobre el trabajo realizado.`,
    `Los equipos no reclamados en ${abandonDays} días se considerarán abandonados.`,
    "No nos responsabilizamos por datos perdidos.",
  ].join("\n");
}

/** Términos a imprimir: los de la empresa o los por defecto */
export function termsLines(s: { terms?: string | null; warrantyDays?: number | null; abandonDays?: number | null } | null | undefined): string[] {
  const text = s?.terms?.trim() || defaultTerms(s?.warrantyDays ?? DEFAULT_WARRANTY_DAYS, s?.abandonDays ?? DEFAULT_ABANDON_DAYS);
  return text.split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)-]\s*/, "").trim()).filter(Boolean);
}

/**
 * Normaliza el "Enlace público" de Configuración: https://dominio.com (sin / final ni /portal).
 * Devuelve null si está vacío o no es una dirección http(s) válida.
 */
export function normalizePublicUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    const path = u.pathname.replace(/\/+$/, "").replace(/\/portal$/i, "");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return null;
  }
}

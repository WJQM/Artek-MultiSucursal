// Datos de la empresa para el servidor (mensajes de WhatsApp, PIN, título, ícono de la app…)
import { prisma } from "./prisma";
import type { CompanyInfo } from "./whatsapp";
import { normalizePublicUrl } from "@/shared/branding";

export const DEFAULT_COMPANY_NAME = "RepairTrackQR";

type SettingsRow = Awaited<ReturnType<typeof prisma.settings.findUnique>>;
let cache: { at: number; value: SettingsRow } | null = null;
const TTL_MS = 30_000;

/** Configuración de la empresa (caché de 30 s; se limpia al guardar en Configuración). */
export async function getSettings(): Promise<SettingsRow> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const value = await prisma.settings.findUnique({ where: { id: "global" } });
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

export function invalidateSettingsCache() {
  cache = null;
}

/** Dirección pública: "Enlace público" de Configuración → APP_URL / dominio de la petición */
export async function publicOrigin(fallback: string): Promise<string> {
  const s = await getSettings();
  return normalizePublicUrl(s?.publicUrl) || fallback;
}

export async function companyInfo(requestOrigin: string): Promise<CompanyInfo> {
  const s = await getSettings();
  const origin = normalizePublicUrl(s?.publicUrl) || requestOrigin;
  return {
    companyName: s?.companyName || DEFAULT_COMPANY_NAME,
    portalUrl: `${origin}/portal`,
    address: s?.address || null,
    phone: s?.phone || null,
  };
}

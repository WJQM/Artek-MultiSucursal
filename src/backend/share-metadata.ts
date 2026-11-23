// Vista previa al compartir un enlace (WhatsApp, Facebook, Telegram…): logo, nombre y eslogan
// del taller tal como están en Admin › Configuración. Si cambia el logo, los enlaces nuevos ya
// salen con el logo nuevo (WhatsApp guarda en memoria las vistas previas ya enviadas).
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSettings, DEFAULT_COMPANY_NAME } from "@/backend/company";

async function baseUrl(): Promise<string> {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

export async function shareMetadata(opts: { title?: string; description?: string } = {}): Promise<Metadata> {
  const s = await getSettings();
  const name = s?.companyName?.trim() || DEFAULT_COMPANY_NAME;
  const v = s?.updatedAt ? s.updatedAt.getTime() : 0;
  const base = await baseUrl();
  const title = opts.title || name;
  const description = opts.description || s?.slogan || "Servicio técnico";
  const image = { url: `${base}/api/brand/icon?size=512&v=${v}`, width: 512, height: 512, alt: name, type: "image/png" };
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    openGraph: { type: "website", siteName: name, title, description, images: [image], locale: "es_BO" },
    twitter: { card: "summary", title, description, images: [image.url] },
  };
}

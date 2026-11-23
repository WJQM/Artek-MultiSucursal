// Reseñas en Google.
// - Cada sucursal guarda el enlace "Pedir reseñas" de su Perfil de Empresa de Google.
// - Después de calificar en el seguimiento, TODOS los clientes ven "Dejar reseña en Google"
//   (Google prohíbe pedir reseñas solo a los clientes contentos).
// - Opcional: al día siguiente de la entrega, WhatsApp al cliente pidiendo su calificación (una sola vez).
// Los clics pasan por /api/reviews/google/go para contarlos; solo se redirige a direcciones de Google.
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";
import { normalizePublicUrl } from "@/shared/branding";
import { clientTrackUrl } from "./track-access";
import { sendWhatsAppSafe } from "./whatsapp";
import { startOfDay, addDays } from "@/shared/dates";

export interface GoogleReviewsConfig { links: Record<string, string>; askNextDay: boolean; hour: number }
const KEY = "reviews:google";
const clicksKey = (d = new Date()) => `reviews:google:clicks:${d.toISOString().slice(0, 7)}`;

export async function getGoogleConfig(): Promise<GoogleReviewsConfig> {
  const c = await readKV<Partial<GoogleReviewsConfig>>(KEY, {});
  return { links: c.links || {}, askNextDay: !!c.askNextDay, hour: Number.isInteger(c.hour) && c.hour! >= 7 && c.hour! <= 20 ? c.hour! : 10 };
}

/** Solo enlaces de Google (así nadie puede usar el sistema para redirigir a otra página). */
export function cleanGoogleLink(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return "";
  let s = v.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const ok = ["g.page", "g.co", "goo.gl", "maps.app.goo.gl", "search.google.com", "google.com", "www.google.com", "maps.google.com", "business.google.com"].includes(host) || /^(www\.)?google\.[a-z.]{2,6}$/.test(host);
    if (!ok || u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    return u.toString().slice(0, 400);
  } catch { return null; }
}

export async function saveGoogleConfig(input: Record<string, unknown>): Promise<GoogleReviewsConfig> {
  const cur = await getGoogleConfig();
  const branches = new Set((await prisma.branch.findMany({ select: { id: true } })).map((b) => b.id));
  const links = { ...cur.links };
  if (input.links && typeof input.links === "object") {
    for (const [id, v] of Object.entries(input.links as Record<string, unknown>)) {
      if (!branches.has(id)) continue;
      const l = cleanGoogleLink(v);
      if (l === null) throw new Error("El enlace debe ser de Google (ej. https://g.page/r/…/review)");
      if (l) links[id] = l; else delete links[id];
    }
  }
  const hour = Number(input.hour);
  const next: GoogleReviewsConfig = {
    links,
    askNextDay: typeof input.askNextDay === "boolean" ? input.askNextDay : cur.askNextDay,
    hour: Number.isInteger(hour) && hour >= 7 && hour <= 20 ? hour : cur.hour,
  };
  await writeKV(KEY, next);
  return next;
}

export async function googleLinkFor(branchId: string | null | undefined): Promise<string | null> {
  if (!branchId) return null;
  return (await getGoogleConfig()).links[branchId] || null;
}

export async function recordClick(branchId: string) {
  const k = clicksKey();
  const c = await readKV<Record<string, number>>(k, {});
  c[branchId] = (c[branchId] || 0) + 1;
  await writeKV(k, c);
}
export async function monthClicks(): Promise<Record<string, number>> {
  return readKV<Record<string, number>>(clicksKey(), {});
}

/** Dirección pública del sistema (para los enlaces del WhatsApp). */
async function publicOrigin(): Promise<string> {
  const s = await getSettings();
  return normalizePublicUrl(s?.publicUrl) || process.env.APP_URL?.trim().replace(/\/+$/, "") || (await readKV<string>("telegram:origin", "")) || "";
}

export function askMessage(r: { code: string; device: string; brand: string | null; model: string | null; clientName: string | null }, company: string, trackUrl: string, googleUrl: string | null) {
  const device = [r.device, r.brand, r.model].filter(Boolean).join(" ");
  return `Hola${r.clientName ? ` *${r.clientName}*` : ""} 👋 Gracias por confiar en *${company}* con su *${device}* (${r.code}).

¿Cómo le fue? Su opinión nos ayuda mucho:
⭐ Califíquenos aquí (30 segundos):
${trackUrl}${googleUrl ? `

Y si puede, déjenos una reseña en Google:
${googleUrl}` : ""}

¡Gracias!`;
}

/** Tarea diaria: WhatsApp a los clientes que recibieron su equipo AYER y todavía no calificaron. */
export async function askYesterdayReviews(): Promise<{ sent: number; skipped: number }> {
  const cfg = await getGoogleConfig();
  if (!cfg.askNextDay) return { sent: 0, skipped: 0 };
  const origin = await publicOrigin();
  if (!origin) { console.error("[Reseñas] Falta la dirección pública del sistema (Configuración › Empresa)"); return { sent: 0, skipped: 0 }; }
  const today = startOfDay();
  const yesterday = startOfDay(addDays(today, -1));
  const rows = await prisma.repair.findMany({
    where: { status: "delivered", deliveredAt: { gte: yesterday, lt: today }, clientPhone: { not: null }, warrantyOf: null },
    select: { id: true, code: true, device: true, brand: true, model: true, clientName: true, clientPhone: true, branchId: true },
    take: 200,
  });
  const reviewed = new Set((await prisma.review.findMany({ where: { repairId: { in: rows.map((r) => r.id) } }, select: { repairId: true } })).map((r) => r.repairId));
  const asked = new Set(await readKV<string[]>("reviews:asked", []));
  const s = await getSettings();
  const company = s?.companyName || "nuestro taller";
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (reviewed.has(r.id) || asked.has(r.id)) { skipped++; continue; }
    const google = cfg.links[r.branchId] ? `${origin}/api/reviews/google/go?r=${encodeURIComponent(r.id)}` : null;
    const ok = await sendWhatsAppSafe(r.clientPhone, askMessage(r, company, clientTrackUrl(origin, r), google));
    asked.add(r.id);
    if (ok) sent++; else skipped++;
    await new Promise((res) => setTimeout(res, 2000)); // pausa entre mensajes
  }
  await writeKV("reviews:asked", [...asked].slice(-2000));
  return { sent, skipped };
}

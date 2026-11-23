// Equipos listos (Completado) que el cliente todavía no recogió.
import { prisma } from "./prisma";
import { getSettings, companyInfo } from "./company";
import { clientTrackUrl } from "./track-access";
import { sendWhatsAppSafe } from "./whatsapp";
import { notifyManagersAll, readKV, writeKV } from "./automation";

const DAY = 86_400_000;

/** A partir de cuántos días se marca "por abandonar" (un mes antes del plazo de abandono, mínimo 7). */
export function warnAfter(abandonDays: number) {
  return Math.max(7, abandonDays - 30);
}

export interface UncollectedItem {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  clientName: string | null; clientPhone: string | null; estimatedCost: number; branchId: string;
  readyAt: string; days: number; remindedAt: string | null; reminders: number;
}

export async function listUncollected(branchId: string | null) {
  const s = await getSettings();
  const abandonDays = s?.abandonDays ?? 90;
  const rows = await prisma.repair.findMany({
    where: { status: "completed", ...(branchId ? { branchId } : {}) },
    select: { id: true, code: true, device: true, brand: true, model: true, clientName: true, clientPhone: true, estimatedCost: true, branchId: true, updatedAt: true, remindedAt: true, reminders: true },
    take: 300,
  });
  // Desde cuándo está lista: último paso a "completed" en el historial (si no hay, la última modificación)
  const hist = rows.length
    ? await prisma.statusHistory.findMany({ where: { repairId: { in: rows.map((r) => r.id) }, toStatus: "completed" }, select: { repairId: true, createdAt: true }, orderBy: { createdAt: "desc" } })
    : [];
  const readyMap = new Map<string, Date>();
  for (const h of hist) if (!readyMap.has(h.repairId)) readyMap.set(h.repairId, h.createdAt);
  const now = Date.now();
  const items: UncollectedItem[] = rows.map((r) => {
    const ready = readyMap.get(r.id) || r.updatedAt;
    return {
      id: r.id, code: r.code, device: r.device, brand: r.brand, model: r.model, clientName: r.clientName, clientPhone: r.clientPhone,
      estimatedCost: r.estimatedCost, branchId: r.branchId, readyAt: ready.toISOString(), days: Math.max(0, Math.floor((now - ready.getTime()) / DAY)),
      remindedAt: r.remindedAt?.toISOString() ?? null, reminders: r.reminders,
    };
  }).sort((a, b) => b.days - a.days);
  return { items, abandonDays, warnAfter: warnAfter(abandonDays) };
}

export function reminderMessage(item: { code: string; device: string; brand: string | null; model: string | null; clientName: string | null; estimatedCost: number }, days: number, abandonDays: number, company: { companyName: string; address?: string | null }, url: string) {
  const device = [item.device, item.brand, item.model].filter(Boolean).join(" ");
  const hello = item.clientName ? `Hola *${item.clientName}*` : "Hola";
  const left = abandonDays - days;
  return `${hello} 👋

Le recordamos que su equipo *${device}* (${item.code}) está *listo para recoger* desde hace ${days === 1 ? "1 día" : `${days} días`}.${item.estimatedCost > 0 ? `\n💰 Total: *Bs. ${item.estimatedCost}*` : ""}

${company.address ? `📍 Lo esperamos en ${company.companyName}: ${company.address}\n` : `📍 Lo esperamos en ${company.companyName}.\n`}🔗 Detalles: ${url}
${left > 0 && left <= 30 ? `\n⚠️ Pasados ${abandonDays} días desde que estuvo listo, el equipo se considera abandonado (quedan ${left} días).\n` : ""}
¡Gracias!`;
}

/** Envía el recordatorio por WhatsApp y lo registra. Devuelve si se envió y el mensaje (para abrir WhatsApp si falla). */
export async function sendReminder(repairId: string, origin: string) {
  const r = await prisma.repair.findUnique({ where: { id: repairId }, select: { id: true, code: true, device: true, brand: true, model: true, clientName: true, clientPhone: true, estimatedCost: true, status: true, updatedAt: true } });
  if (!r || r.status !== "completed") return { sent: false, message: "", phone: null as string | null, error: "La orden ya no está lista para recoger" };
  const s = await getSettings();
  const abandonDays = s?.abandonDays ?? 90;
  const h = await prisma.statusHistory.findFirst({ where: { repairId: r.id, toStatus: "completed" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const days = Math.max(0, Math.floor((Date.now() - (h?.createdAt || r.updatedAt).getTime()) / DAY));
  const company = await companyInfo(origin);
  const base = company.portalUrl.replace(/\/portal$/, "");
  const message = reminderMessage(r, days, abandonDays, company, clientTrackUrl(base, r));
  const sent = r.clientPhone ? await sendWhatsAppSafe(r.clientPhone, message) : false;
  if (sent) await prisma.repair.update({ where: { id: r.id }, data: { remindedAt: new Date(), reminders: { increment: 1 } } });
  return { sent, message, phone: r.clientPhone };
}

/** Tarea diaria: avisa en la campana cuando un equipo pasa a "por abandonar" (una vez por equipo). */
export async function checkUncollected() {
  const { items, warnAfter: limit, abandonDays } = await listUncollected(null);
  const warned = new Set(await readKV<string[]>("uncollected:warned", []));
  const current = new Set(items.map((i) => i.id));
  const fresh = items.filter((i) => i.days >= limit && !warned.has(i.id));
  for (const i of fresh) {
    const left = abandonDays - i.days;
    await notifyManagersAll("uncollected", `📦 ${i.code} lleva ${i.days} días sin recoger`,
      `${[i.device, i.brand].filter(Boolean).join(" ")} de ${i.clientName || "cliente"}. ${left > 0 ? `En ${left} días se considera abandonado.` : "Ya pasó el plazo de abandono."} Puedes recordarle por WhatsApp desde el panel.`, i.branchId).catch(() => {});
    warned.add(i.id);
  }
  // Solo se recuerdan los que siguen sin recoger
  await writeKV("uncollected:warned", [...warned].filter((id) => current.has(id)));
  return fresh.length;
}

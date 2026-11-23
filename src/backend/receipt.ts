// Comprobante de entrega (CE) digital: enlace personal + mensaje de WhatsApp para el cliente.
import { companyInfo, getSettings } from "./company";
import { signClientLink } from "./track-access";
import { APP_TZ } from "@/shared/dates";

export interface ReceiptRepair {
  id: string; code: string; device: string; brand?: string | null; model?: string | null;
  clientName?: string | null; clientPhone?: string | null; estimatedCost?: number | null;
  deliveredAt?: Date | null; updatedAt?: Date | null;
}

const DAY = 86_400_000;

export function fmtDateLong(d: Date) {
  return d.toLocaleDateString("es-BO", { timeZone: APP_TZ, day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
}

/** Fecha hasta la que vale la garantía (entrega + días de garantía de Configuración); null si no hay garantía. */
export async function warrantyUntil(deliveredAt: Date | null | undefined): Promise<Date | null> {
  if (!deliveredAt) return null;
  const s = await getSettings();
  const days = s?.warrantyDays ?? 30;
  return days > 0 ? new Date(deliveredAt.getTime() + days * DAY) : null;
}

export async function deliveryReceipt(repair: ReceiptRepair, requestOrigin: string) {
  const company = await companyInfo(requestOrigin);
  const base = company.portalUrl.replace(/\/portal$/, "");
  const ceCode = repair.code.replace(/^OT-/i, "CE-");
  const url = `${base}/delivery/view/${encodeURIComponent(repair.code)}?k=${signClientLink(repair.id)}`;
  const until = await warrantyUntil(repair.deliveredAt ?? null);
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  const total = Number(repair.estimatedCost || 0);
  const hello = repair.clientName ? `Hola *${repair.clientName}*` : "Hola";
  const message = `${hello} 👋
Gracias por confiar en *${company.companyName}*.

✅ Entregamos su *${device}* (${repair.code}).${total > 0 ? `\n💰 Total: *Bs. ${total}*` : ""}${until ? `\n🛡️ Garantía hasta el *${fmtDateLong(until)}*` : ""}

📄 Su comprobante de entrega *${ceCode}* (puede guardarlo en PDF):
🔗 ${url}

🛍️ Conozca nuestros productos y servicios:
🔗 ${company.portalUrl}

¡Hasta pronto!`;
  return { url, message, ceCode, warrantyUntil: until?.toISOString() ?? null };
}

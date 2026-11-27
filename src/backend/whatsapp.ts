// Envío de WhatsApp por WasenderAPI. Si falla, NO bloquea la respuesta al usuario.
import { normalizePhone } from "./phone";
import { readKV, writeKV } from "./automation";

// Clave de WasenderApi: la guardada en Configuración (KeyValue) o, si no hay, la del .env.
// Nunca se devuelve al navegador: solo sus últimos 4 caracteres.
const KV_KEY = "whatsapp:config";
const apiBase = () => (process.env.WASENDER_API_BASE || "https://www.wasenderapi.com").replace(/\/+$/, "");
let cache: { at: number; key: string } | null = null;

async function savedKey(): Promise<string> {
  const c = await readKV<{ apiKey?: string }>(KV_KEY, {});
  return (c.apiKey || "").trim();
}

export async function wasenderKey(): Promise<string> {
  if (cache && Date.now() - cache.at < 30_000) return cache.key;
  const key = (await savedKey()) || process.env.WASENDER_API_KEY || "";
  cache = { at: Date.now(), key };
  return key;
}

export async function whatsappConfigured(): Promise<boolean> {
  return !!(await wasenderKey());
}

export async function publicWhatsAppConfig() {
  const saved = await savedKey();
  const env = process.env.WASENDER_API_KEY || "";
  const active = saved || env;
  return { configured: !!active, source: saved ? "config" : env ? "env" : "none", last4: active ? active.slice(-4) : null };
}

/** Comprueba la clave contra WasenderApi antes de guardarla. Clave vacía = quitarla (vuelve a la del .env). */
export async function saveWhatsAppKey(apiKey: string): Promise<{ config: Awaited<ReturnType<typeof publicWhatsAppConfig>>; warning?: string }> {
  const key = apiKey.trim();
  if (!key) {
    await writeKV(KV_KEY, {});
    cache = null;
    return { config: await publicWhatsAppConfig() };
  }
  if (key.length < 16 || /\s/.test(key)) throw new Error("La clave no tiene el formato de WasenderApi");
  let warning: string | undefined;
  try {
    const res = await fetch(`${apiBase()}/api/status`, { headers: { Authorization: `Bearer ${key}` } });
    const body = await res.json().catch(() => null) as { status?: string; message?: string } | null;
    if (res.status === 401 || res.status === 403) throw new Error("WasenderApi rechazó la clave: no es válida o el plan venció");
    if (res.ok) {
      const st = String(body?.status || "").toLowerCase();
      if (st && st !== "connected") warning = "Clave guardada, pero el WhatsApp de esa sesión no está conectado: escanea el QR en wasenderapi.com";
    } else {
      warning = "Clave guardada, pero no se pudo comprobar el estado: envía un mensaje de prueba";
    }
  } catch (e) {
    if ((e as Error).message.startsWith("WasenderApi rechazó")) throw e;
    warning = "Clave guardada, pero no se pudo conectar con WasenderApi para comprobarla: envía un mensaje de prueba";
  }
  await writeKV(KV_KEY, { apiKey: key });
  cache = null;
  return { config: await publicWhatsAppConfig(), warning };
}

export type WhatsAppResult = { ok: true; msgId?: string } | { ok: false; error: string };

/** Motivo entendible de por qué WasenderApi no envió el mensaje */
function explainWasender(status: number, body: { message?: unknown; error?: unknown } | null): string {
  const raw = String(body?.message || body?.error || "").trim();
  const m = raw.toLowerCase();
  if (status === 401 || status === 403 || /unauthor|api key|token/.test(m)) return "La clave de WasenderApi no es válida o el plan venció";
  if (status === 429 || /rate|too many|limit/.test(m)) return "WasenderApi pide esperar un momento entre mensajes (límite del plan)";
  if (/session|disconnect|not connected|logged out|qr/.test(m)) return "El WhatsApp del taller está desconectado en WasenderApi: entra a wasenderapi.com y vuelve a escanear el QR";
  if (/not.*(exist|registered|on whatsapp)|invalid.*(number|phone|jid)/.test(m)) return "Ese número no tiene WhatsApp o está mal escrito";
  return raw ? `WasenderApi: ${raw.slice(0, 160)}` : `No se pudo enviar (WasenderApi respondió ${status})`;
}

/** Envía y devuelve el motivo si falla (para mostrarlo en pantalla). */
export async function sendWhatsApp(phone: string | null | undefined, message: string): Promise<WhatsAppResult> {
  const API_KEY = await wasenderKey();
  if (!API_KEY) return { ok: false, error: "El WhatsApp automático no está configurado (agrega la clave de WasenderApi en Configuración → Avisos)" };
  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: "Número de celular inválido" };
  if (!message?.trim()) return { ok: false, error: "Mensaje vacío" };

  try {
    const res = await fetch(`${apiBase()}/api/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ to: `+${to}`, text: message }),
    });
    const body = await res.json().catch(() => null);
    if (body?.success) return { ok: true, msgId: body.data?.msgId };
    console.error("[WhatsApp] WasenderApi:", res.status, body);
    return { ok: false, error: explainWasender(res.status, body) };
  } catch (error) {
    console.error("[WhatsApp] Error de envío:", error);
    return { ok: false, error: "Error al enviar mensaje" };
  }
}

export async function sendWhatsAppSafe(phone: string | null | undefined, message: string): Promise<boolean> {
  return (await sendWhatsApp(phone, message)).ok;
}

interface RepairInfo {
  code: string;
  device: string;
  brand?: string | null;
  model?: string | null;
  estimatedCost?: number;
  clientName?: string | null;
}

export interface CompanyInfo {
  companyName: string;
  /** Portal público de ESTA instalación (https://dominio/portal), ver companyInfo() */
  portalUrl: string;
  address?: string | null;
  phone?: string | null;
}

/** Si el mensaje lleva el enlace personal de la orden, se agrega también el portal (catálogo) */
function portalExtra(company: CompanyInfo, personal?: string): string {
  return personal ? `\n\n🛍️ Conozca nuestros productos y servicios:\n🔗 ${company.portalUrl}` : "";
}

export function buildRepairCreatedMessage(repair: RepairInfo, company: CompanyInfo, trackUrl?: string): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  return `${name}! 👋

Recibimos su equipo *${device}* en ${company.companyName}. Gracias por confiar en nosotros.

📋 *Código de seguimiento:* ${repair.code}

${trackUrl ? "Vea el estado de su reparación aquí (enlace personal, no lo comparta):" : "Puede consultar el estado de su reparación ingresando su código en nuestro portal:"}
🔗 ${trackUrl || company.portalUrl}${portalExtra(company, trackUrl)}

Le avisaremos cuando tengamos novedades. ¡Saludos! 🛠️`;
}

/** Sucursal donde el cliente recoge su equipo (dirección y enlace "Cómo llegar"). */
export interface PickupInfo { name: string; address?: string | null; mapUrl?: string | null }

export function buildRepairCompletedMessage(repair: RepairInfo, company: CompanyInfo, trackUrl?: string, pickup?: PickupInfo | null): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  const total = repair.estimatedCost ? `💰 Total: *Bs. ${repair.estimatedCost}*` : "";
  return `${name}! ✅

¡Buenas noticias! Su equipo *${device}* ya está *listo para recoger*.

📋 Código: ${repair.code}
${total}

${pickup
    ? `Puede recogerlo en *${company.companyName} — ${pickup.name}*.${pickup.address ? `\n📍 ${pickup.address}` : ""}${pickup.mapUrl ? `\n🗺️ Cómo llegar: ${pickup.mapUrl}` : ""}`
    : `Por favor acérquese a nuestra tienda ${company.companyName} para retirarlo.${company.address ? `\n📍 ${company.address}` : ""}`}

${trackUrl ? "Vea los detalles aquí:" : `Consulte detalles en nuestro portal con su código ${repair.code}:`}
🔗 ${trackUrl || company.portalUrl}${portalExtra(company, trackUrl)}

¡Gracias por su paciencia! 🎉`;
}

export function buildRepairDeliveredMessage(repair: RepairInfo, company: CompanyInfo, ceCode: string, ceUrl?: string): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  return `${name}! 📦

Su equipo *${device}* fue entregado correctamente.

Gracias por elegir ${company.companyName}. Este es su certificado de entrega:
📄 *${ceCode}*

${ceUrl ? "Puede ver y descargar su certificado aquí:" : `Puede consultar y descargar su certificado ingresando el código ${ceCode} en nuestro portal:`}
🔗 ${ceUrl || company.portalUrl}${portalExtra(company, ceUrl)}

Ante cualquier duda estamos a su disposición. ¡Hasta pronto! 👋`;
}

export function buildDiagnosticMessage(repair: RepairInfo, company: CompanyInfo, trackUrl?: string): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  return `${name}! 🔍

Terminamos el diagnóstico de su equipo *${device}*. 

📋 Código: ${repair.code}

Un técnico lo contactará pronto para detallar el procedimiento a seguir. Mientras tanto puede ver el avance ${trackUrl ? "aquí" : "ingresando su código en nuestro portal"}:
🔗 ${trackUrl || company.portalUrl}${portalExtra(company, trackUrl)}

— ${company.companyName}`;
}

export function buildInProgressMessage(repair: RepairInfo, company: CompanyInfo, trackUrl?: string): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  return `${name}! 🔧

Le informamos que su equipo *${device}* está *en reparación* ahora mismo.

📋 Código: ${repair.code}

Le avisaremos apenas esté listo. ${trackUrl ? "Consulte el avance aquí:" : `Consulte el avance con su código ${repair.code} en nuestro portal:`}
🔗 ${trackUrl || company.portalUrl}${portalExtra(company, trackUrl)}

— ${company.companyName}`;
}

export function buildWaitingPartsMessage(repair: RepairInfo, company: CompanyInfo, trackUrl?: string): string {
  const name = repair.clientName ? `Hola ${repair.clientName}` : "Hola";
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  return `${name}! 📦

Su equipo *${device}* está a la espera de repuestos.

📋 Código: ${repair.code}

Apenas tengamos la pieza continuaremos con la reparación. ${trackUrl ? "Consulte los detalles aquí:" : `Consulte detalles con su código ${repair.code} en:`}
🔗 ${trackUrl || company.portalUrl}${portalExtra(company, trackUrl)}

Gracias por su paciencia.
— ${company.companyName}`;
}

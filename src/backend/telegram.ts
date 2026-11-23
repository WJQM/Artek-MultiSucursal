// Telegram como segundo canal de avisos (respaldo de WhatsApp). Gratis.
// - El taller crea un bot con @BotFather y pega el token en Configuración.
// - Cada persona lo vincula en Mi cuenta: abre t.me/<bot>?start=<código> y toca "Iniciar".
// - Los avisos del celular (lib/push.ts) también se envían por Telegram a quien lo vinculó.
// - Si el WhatsApp al dueño falla, el resumen del día y las alertas salen por Telegram a los Super Admin vinculados.
// Sin webhook: los "Iniciar" se leen con getUpdates cuando alguien pulsa "Vincular" o "Comprobar".
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";
import { normalizePublicUrl } from "@/shared/branding";

export interface TelegramConfig { token: string; username: string; botName: string }
const KEY = "telegram:config";
const linkKey = (userId: string) => `telegram:link:${userId}`;
const pendingKey = (code: string) => `telegram:pending:${code}`;
const OFFSET_KEY = "telegram:offset";
const ORIGIN_KEY = "telegram:origin";

const api = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");

export async function getTelegramConfig(): Promise<TelegramConfig> {
  return { token: "", username: "", botName: "", ...(await readKV<Partial<TelegramConfig>>(KEY, {})) };
}
export async function publicTelegramConfig() {
  const c = await getTelegramConfig();
  return { username: c.username, botName: c.botName, hasToken: !!c.token, ready: !!(c.token && c.username) };
}

async function call<T = unknown>(token: string, method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  try {
    const r = await fetch(`${api()}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
    return (await r.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
  } catch (e) {
    return { ok: false, description: (e as Error)?.message || "Sin conexión con Telegram" };
  }
}

/** Guarda el token después de comprobarlo con getMe. */
export async function saveTelegramToken(token: string) {
  const t = token.trim();
  if (!t) { await writeKV(KEY, { token: "", username: "", botName: "" }); return publicTelegramConfig(); }
  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) throw new Error("El token no tiene el formato de @BotFather (ej. 123456789:AAH…)");
  const me = await call<{ username: string; first_name: string }>(t, "getMe");
  if (!me.ok || !me.result) throw new Error(me.error_code === 401 ? "Token incorrecto: cópialo de nuevo desde @BotFather" : `No se pudo conectar con Telegram: ${me.description || "error"}`);
  await writeKV(KEY, { token: t, username: me.result.username, botName: me.result.first_name });
  return publicTelegramConfig();
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** Dirección pública para armar enlaces en los mensajes. */
async function baseUrl(): Promise<string> {
  const s = await getSettings();
  return normalizePublicUrl(s?.publicUrl) || process.env.APP_URL?.trim().replace(/\/+$/, "") || (await readKV<string>(ORIGIN_KEY, ""));
}
export async function rememberOrigin(origin: string) {
  if (origin && /^https?:\/\//.test(origin)) await writeKV(ORIGIN_KEY, origin.replace(/\/+$/, ""));
}

/** Envía un mensaje a un chat. Texto plano (se escapa) o con título en negrita. Nunca lanza error. */
export async function sendTelegram(chatId: string | number, msg: { title?: string; body: string; url?: string }): Promise<{ ok: boolean; error?: string; gone?: boolean }> {
  const c = await getTelegramConfig();
  if (!c.token) return { ok: false, error: "Telegram no está configurado" };
  let link = "";
  if (msg.url) {
    const abs = /^https?:\/\//.test(msg.url) ? msg.url : `${await baseUrl()}${msg.url}`;
    if (/^https?:\/\//.test(abs)) link = `\n\n👉 <a href="${esc(abs)}">Abrir en el sistema</a>`;
  }
  const text = `${msg.title ? `<b>${esc(msg.title)}</b>\n` : ""}${esc(msg.body)}${link}`.slice(0, 4000);
  const r = await call(c.token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
  // 403: la persona bloqueó o borró el bot → se desvincula
  return r.ok ? { ok: true } : { ok: false, error: r.description, gone: r.error_code === 403 || r.error_code === 400 && /chat not found/i.test(r.description || "") };
}

// ---------- vinculación de cada persona ----------
export interface TelegramLink { chatId: string; name: string; at: string }

export async function getLink(userId: string): Promise<TelegramLink | null> {
  return readKV<TelegramLink | null>(linkKey(userId), null);
}
export async function unlink(userId: string) {
  await prisma.keyValue.deleteMany({ where: { key: linkKey(userId) } });
}

/** Crea el enlace t.me/<bot>?start=<código> (vale 15 minutos). */
export async function startLink(userId: string): Promise<{ url: string; code: string } | { error: string }> {
  const c = await getTelegramConfig();
  if (!c.token || !c.username) return { error: "El Super Admin todavía no configuró el bot de Telegram" };
  const code = randomBytes(9).toString("base64url");
  await writeKV(pendingKey(code), { userId, exp: Date.now() + 15 * 60_000 });
  return { url: `https://t.me/${c.username}?start=${code}`, code };
}

interface Update { update_id: number; message?: { text?: string; chat: { id: number; first_name?: string; username?: string; type: string } } }

/** Lee los "Iniciar" pendientes y vincula a quien corresponda. Devuelve cuántos vinculó. */
export async function processUpdates(): Promise<number> {
  const c = await getTelegramConfig();
  if (!c.token) return 0;
  const offset = await readKV<number>(OFFSET_KEY, 0);
  const r = await call<Update[]>(c.token, "getUpdates", { offset: offset || undefined, timeout: 0, allowed_updates: ["message"] });
  if (!r.ok || !r.result?.length) return 0;
  let linked = 0;
  for (const u of r.result) {
    const m = u.message;
    const code = m?.text?.match(/^\/start\s+([A-Za-z0-9_-]{6,40})/)?.[1];
    if (m && code && m.chat.type === "private") {
      const p = await readKV<{ userId: string; exp: number } | null>(pendingKey(code), null);
      if (p && p.exp > Date.now()) {
        const name = m.chat.first_name || m.chat.username || "Telegram";
        await writeKV(linkKey(p.userId), { chatId: String(m.chat.id), name, at: new Date().toISOString() } satisfies TelegramLink);
        await prisma.keyValue.deleteMany({ where: { key: pendingKey(code) } });
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true } });
        await sendTelegram(m.chat.id, { title: "✅ Telegram vinculado", body: `Hola${user?.name ? ` ${user.name}` : ""}. Desde ahora recibirás aquí los avisos del sistema que elegiste en Mi cuenta.` });
        linked++;
      } else {
        await sendTelegram(m.chat.id, { body: "Ese enlace venció. Vuelve a tocar “Vincular mi Telegram” en Mi cuenta." });
      }
    } else if (m?.text?.startsWith("/start")) {
      await sendTelegram(m.chat.id, { body: "Para recibir avisos, entra al sistema → Mi cuenta → “Vincular mi Telegram”." });
    }
  }
  await writeKV(OFFSET_KEY, r.result[r.result.length - 1].update_id + 1);
  return linked;
}

/** Envía a varias personas vinculadas (desvincula a quien bloqueó el bot). */
export async function sendTelegramToUsers(userIds: string[], msg: { title?: string; body: string; url?: string }): Promise<number> {
  const c = await getTelegramConfig();
  if (!c.token || !userIds.length) return 0;
  let sent = 0;
  for (const id of [...new Set(userIds)]) {
    const link = await getLink(id);
    if (!link) continue;
    const r = await sendTelegram(link.chatId, msg);
    if (r.ok) sent++;
    else if (r.gone) await unlink(id);
  }
  return sent;
}

/** Respaldo cuando el WhatsApp al dueño falla: a los Super Admin con Telegram vinculado. */
export async function telegramToOwners(title: string, body: string, url?: string): Promise<number> {
  const supers = await prisma.user.findMany({ where: { role: "superadmin", status: "active" }, select: { id: true } });
  return sendTelegramToUsers(supers.map((s) => s.id), { title, body, url });
}

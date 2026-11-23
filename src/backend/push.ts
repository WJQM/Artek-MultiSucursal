// Avisos en el celular (Web Push): llegan aunque el sistema esté cerrado.
// No usa ningún servicio de pago: el navegador (Chrome/Google, Safari/Apple, Firefox) los entrega.
//
// Claves del servidor (VAPID): si no están en el .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY),
// se generan solas la primera vez y se guardan en la base de datos (KeyValue "push:vapid").
// Así no hay que configurar nada para que funcione.
import webpush from "web-push";
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";

export const PUSH_CATEGORIES = [
  { key: "assigned", label: "Órdenes asignadas a mí", hint: "“Te asignaron OT-15 · iPhone 12”", roles: ["tech", "admin", "superadmin"] },
  { key: "new_orders", label: "Nuevas órdenes de la sucursal", hint: "Solo administradores", roles: ["admin", "superadmin"] },
  { key: "ready", label: "Equipo listo para entregar", hint: "Cuando un técnico lo marca listo", roles: ["admin", "superadmin"] },
  { key: "log", label: "Notas en la bitácora de una orden", hint: "Diagnóstico, repuestos, avances", roles: ["tech", "admin", "superadmin"] },
  { key: "chat", label: "Mensajes del chat interno", hint: "", roles: ["tech", "admin", "superadmin"] },
  { key: "reviews", label: "Reseñas de clientes", hint: "", roles: ["admin", "superadmin"] },
  { key: "appointments", label: "Citas reservadas por clientes", hint: "Nueva cita o cancelación desde el portal", roles: ["admin", "superadmin"] },
  { key: "reservations", label: "Productos apartados por clientes", hint: "Nuevo apartado desde el portal, cancelación o vencimiento", roles: ["admin", "superadmin"] },
  { key: "stock", label: "Stock bajo del inventario", hint: "Al bajar del mínimo y resumen de las 8:00", roles: ["admin", "superadmin"] },
  { key: "system", label: "Alertas del sistema", hint: "Respaldo fallido, equipos por abandonar", roles: ["admin", "superadmin"] },
] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number]["key"];
export type PushPrefs = Record<PushCategory, boolean>;

const DEFAULT_PREFS: PushPrefs = { assigned: true, new_orders: true, ready: true, log: true, chat: true, reviews: false, appointments: true, reservations: true, stock: true, system: true };
const prefsKey = (userId: string) => `push:prefs:${userId}`;

export async function getPushPrefs(userId: string): Promise<PushPrefs> {
  const saved = await readKV<Partial<PushPrefs>>(prefsKey(userId), {});
  return { ...DEFAULT_PREFS, ...saved };
}
export async function savePushPrefs(userId: string, input: Partial<Record<string, unknown>>): Promise<PushPrefs> {
  const cur = await getPushPrefs(userId);
  for (const c of PUSH_CATEGORIES) if (typeof input[c.key] === "boolean") cur[c.key] = input[c.key] as boolean;
  await writeKV(prefsKey(userId), cur);
  return cur;
}

const g = globalThis as unknown as { __vapid?: { publicKey: string; privateKey: string } };

/** Claves VAPID: del .env, o generadas una vez y guardadas en la base de datos. */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (g.__vapid) return g.__vapid;
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim(), envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  let keys: { publicKey: string; privateKey: string } | null = envPub && envPriv ? { publicKey: envPub, privateKey: envPriv } : null;
  if (!keys) {
    keys = await readKV<{ publicKey: string; privateKey: string } | null>("push:vapid", null);
    if (!keys?.publicKey || !keys?.privateKey) {
      keys = webpush.generateVAPIDKeys();
      await writeKV("push:vapid", keys);
    }
  }
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${process.env.ADMIN_EMAIL?.trim() || "avisos@repairtrack.local"}`;
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  g.__vapid = keys;
  return keys;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Página que se abre al tocar el aviso */
  url?: string;
  /** Avisos con la misma etiqueta se reemplazan (ej. varios mensajes del mismo chat) */
  tag?: string;
}

/** Envía un aviso a todos los celulares de esas personas que tengan activada la categoría. Nunca lanza error. */
export async function sendPush(userIds: (string | null | undefined)[], category: PushCategory, payload: PushPayload, opts: { force?: boolean } = {}): Promise<number> {
  try {
    const ids = [...new Set(userIds.filter(Boolean) as string[])];
    if (!ids.length) return 0;
    // Telegram (si la persona lo vinculó): mismas preferencias que los avisos del celular
    const tg = (async () => {
      const { sendTelegramToUsers } = await import("./telegram");
      const ok: string[] = [];
      for (const id of ids) if (opts.force || (await getPushPrefs(id))[category]) ok.push(id);
      return sendTelegramToUsers(ok, { title: payload.title, body: payload.body, url: payload.url });
    })().catch(() => 0);
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (!subs.length) return await tg;
    await vapidKeys();
    const allowed = new Map<string, boolean>();
    for (const id of new Set(subs.map((s) => s.userId))) allowed.set(id, opts.force || (await getPushPrefs(id))[category]);
    let sent = 0;
    await Promise.all(subs.filter((s) => allowed.get(s.userId)).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/", tag: payload.tag }),
          { TTL: 60 * 60 * 24, urgency: category === "system" || category === "assigned" ? "high" : "normal" },
        );
        sent++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        // 404/410: el navegador ya no acepta avisos (desinstaló, borró datos o desactivó): se olvida
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("[Avisos] No se pudo enviar:", code || (e as Error)?.message);
      }
    }));
    return sent + (await tg);
  } catch (e) {
    console.error("[Avisos]", e);
    return 0;
  }
}

/** Administradores de la sucursal (o de todas si branchId es null) y super admins, menos quien hizo la acción. */
export async function managerIds(branchId: string | null, exceptUserId?: string | null): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { status: "active", OR: [{ role: "superadmin" }, branchId ? { role: "admin", branchId } : { role: "admin" }] },
    select: { id: true },
  });
  return rows.map((r) => r.id).filter((id) => id !== exceptUserId);
}

/** Enlace para abrir una orden según el rol: el técnico la ve en Mis asignaciones. */
export async function repairLinkFor(userIds: string[], code: string): Promise<Map<string, string>> {
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } });
  return new Map(rows.map((u) => [u.id, `${u.role === "tech" ? "/asignaciones" : "/dashboard"}?focus=${encodeURIComponent(code)}`]));
}

/** Aviso de una orden a varias personas, cada una con el enlace correcto para su rol. */
export async function pushRepair(userIds: (string | null | undefined)[], category: PushCategory, code: string, title: string, body: string) {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return;
  const links = await repairLinkFor(ids, code);
  await Promise.all(ids.map((id) => sendPush([id], category, { title, body, url: links.get(id) || "/dashboard", tag: `ot-${code}` })));
}

/** Para usar sin esperar (no demora la respuesta al usuario). */
export function later(p: Promise<unknown>) { p.catch((e) => console.error("[Avisos]", e)); }

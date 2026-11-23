// Apartados desde el portal: el cliente reserva un producto, equipo o consola por unas horas
// (24 h por defecto, configurable por sucursal). El stock real NO se descuenta: el portal solo
// muestra lo disponible (stock − apartado). Al venderlo se crea la nota de venta y ahí baja el stock.
//
// Dos clientes a la vez: cada apartado se crea dentro de una transacción con candado de la base,
// así que se atienden de a uno — el primero se lo lleva y el segundo recibe "ya lo apartaron".
// Además, un índice único impide dos apartados activos del mismo equipo o consola.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";
import { sendWhatsAppSafe } from "./whatsapp";
import { signClientLink } from "./track-access";
import { normalizePhone } from "./phone";
import { fmtWhen, publicOrigin } from "./appointments";
import { withUniqueRetry } from "./unique-retry";
import { applySaleChange, saleCost, saleEffect, alertAfter, type Moved, type SaleLine } from "./stock-moves";

export type ResvKind = "inventory" | "equipment" | "console";
export const RESV_KINDS: ResvKind[] = ["inventory", "equipment", "console"];
export interface BranchResvCfg { enabled: boolean; hours: number }
export const HOURS_OPTIONS = [6, 12, 24, 48, 72];
export const MAX_ACTIVE_PER_PHONE = 2;
export const MAX_QTY = 3;
const KEY = "reservas:config";
const DEFAULT: BranchResvCfg = { enabled: false, hours: 24 };

export class ResvError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

// ---------- configuración por sucursal ----------
export async function getResvConfig(): Promise<{ branches: Record<string, BranchResvCfg> }> {
  const c = await readKV<{ branches?: Record<string, BranchResvCfg> }>(KEY, {});
  return { branches: c.branches || {} };
}
export async function branchResvCfg(branchId: string): Promise<BranchResvCfg> {
  return { ...DEFAULT, ...((await getResvConfig()).branches[branchId] || {}) };
}
export async function saveBranchResvCfg(branchId: string, input: Partial<BranchResvCfg>): Promise<BranchResvCfg> {
  const cur = await branchResvCfg(branchId);
  const next: BranchResvCfg = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : cur.enabled,
    hours: HOURS_OPTIONS.includes(Number(input.hours)) ? Number(input.hours) : cur.hours,
  };
  const c = await getResvConfig();
  c.branches[branchId] = next;
  await writeKV(KEY, c);
  return next;
}

// ---------- lo que está apartado ahora ----------
/** Para el portal: sucursales activas, cantidades apartadas por producto y equipos/consolas apartados. */
export async function holdsSnapshot() {
  await expireDue();
  const [cfg, active] = await Promise.all([
    getResvConfig(),
    prisma.reservation.findMany({ where: { status: "active" }, select: { kind: true, itemId: true, qty: true } }),
  ]);
  const inv: Record<string, number> = {};
  const equipment: string[] = [], consoles: string[] = [];
  for (const r of active) {
    if (r.kind === "inventory") inv[r.itemId] = (inv[r.itemId] || 0) + r.qty;
    else if (r.kind === "equipment") equipment.push(r.itemId);
    else if (r.kind === "console") consoles.push(r.itemId);
  }
  const branches: Record<string, number> = {};
  for (const [id, b] of Object.entries(cfg.branches)) if (b.enabled) branches[id] = b.hours || 24;
  return { branches, inv, equipment, consoles, maxQty: MAX_QTY };
}

type Tx = Prisma.TransactionClient;
interface ItemInfo { kind: ResvKind; id: string; name: string; price: number; branchId: string; stock: number }

/** Producto, equipo o consola visible en el portal (null si no existe o está oculto). */
async function loadItem(tx: Tx, kind: ResvKind, id: string): Promise<ItemInfo | null> {
  if (kind === "inventory") {
    const i = await tx.inventoryItem.findUnique({ where: { id }, select: { id: true, name: true, price: true, quantity: true, active: true, showInPortal: true, branchId: true } });
    return i && i.active && i.showInPortal ? { kind, id: i.id, name: i.name, price: i.price, branchId: i.branchId, stock: i.quantity } : null;
  }
  if (kind === "equipment") {
    const e = await tx.equipment.findUnique({ where: { id }, select: { id: true, name: true, brand: true, model: true, price: true, condition: true, showInPortal: true, branchId: true } });
    const name = [e?.brand, e?.model].filter(Boolean).join(" ") || e?.name || "Equipo";
    return e && e.showInPortal ? { kind, id: e.id, name, price: e.price, branchId: e.branchId, stock: e.condition === "disponible" ? 1 : 0 } : null;
  }
  const c = await tx.console.findUnique({ where: { id }, select: { id: true, name: true, brand: true, model: true, price: true, condition: true, showInPortal: true, active: true, branchId: true } });
  const name = c?.name || [c?.brand, c?.model].filter(Boolean).join(" ") || "Consola";
  return c && c.active && c.showInPortal ? { kind, id: c.id, name, price: c.price, branchId: c.branchId, stock: c.condition === "disponible" ? 1 : 0 } : null;
}

/** Cuánto queda libre para apartar (stock − apartados activos). */
async function freeUnits(tx: Tx, item: ItemInfo): Promise<number> {
  const held = await tx.reservation.aggregate({ where: { kind: item.kind, itemId: item.id, status: "active" }, _sum: { qty: true } });
  return item.stock - (held._sum.qty || 0);
}

async function nextCode(tx: Tx, branchId: string): Promise<string> {
  const r = await tx.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0) AS n FROM "Reservation" WHERE "branchId" = ${branchId} AND code ~ '^AP-[0-9]+$'`;
  return `AP-${Number(r[0]?.n || 0) + 1}`;
}

// ---------- crear ----------
export async function createReservation(input: { kind: unknown; itemId: unknown; qty?: unknown; clientName: unknown; clientPhone: unknown }) {
  const kind = RESV_KINDS.includes(input.kind as ResvKind) ? (input.kind as ResvKind) : null;
  const itemId = typeof input.itemId === "string" ? input.itemId.slice(0, 60) : "";
  const clientName = typeof input.clientName === "string" ? input.clientName.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  const phone = normalizePhone(input.clientPhone);
  const qty = kind === "inventory" ? Math.floor(Number(input.qty) || 1) : 1;
  if (!kind || !itemId) throw new ResvError("Producto inválido");
  if (clientName.length < 2) throw new ResvError("Escribe tu nombre");
  if (!phone) throw new ResvError("Escribe un celular válido (8 dígitos)");
  if (qty < 1 || qty > MAX_QTY) throw new ResvError(`Puedes apartar de 1 a ${MAX_QTY} unidades`);

  return withUniqueRetry(() => prisma.$transaction(async (tx) => {
    // De a uno: dos clientes que aparten a la vez no pueden tomar la misma unidad
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('reservations:portal'))`;
    const item = await loadItem(tx, kind, itemId);
    if (!item) throw new ResvError("Este producto ya no está disponible", 404);
    const cfg = await branchResvCfg(item.branchId);
    if (!cfg.enabled) throw new ResvError("Esta sucursal no recibe apartados en línea. Escríbenos por WhatsApp.");

    const mine = await tx.reservation.findMany({ where: { clientPhone: phone, status: "active" }, select: { kind: true, itemId: true } });
    if (mine.some((r) => r.kind === kind && r.itemId === itemId)) throw new ResvError("Ya tienes este producto apartado. Revisa el enlace que te llegó por WhatsApp.");
    if (mine.length >= MAX_ACTIVE_PER_PHONE) throw new ResvError(`Ya tienes ${MAX_ACTIVE_PER_PHONE} apartados activos con este celular. Recoge o cancela uno para apartar otro.`);

    const free = await freeUnits(tx, item);
    if (free < qty) {
      throw free > 0
        ? new ResvError(`Solo quedan ${free} disponible${free === 1 ? "" : "s"} para apartar.`, 409, "LESS")
        : new ResvError("😕 Alguien acaba de apartar la última unidad.", 409, "TAKEN");
    }
    return tx.reservation.create({
      data: {
        code: await nextCode(tx, item.branchId), branchId: item.branchId, kind, itemId, itemName: item.name,
        price: item.price, qty, total: Math.round(item.price * qty * 100) / 100,
        clientName, clientPhone: phone, expiresAt: new Date(Date.now() + cfg.hours * 3600_000),
      },
    });
  }));
}

// ---------- mensajes ----------
/** Dirección pública para los enlaces de WhatsApp. Las tareas automáticas no tienen la petición del
 *  cliente, así que se recuerda la última dirección usada al apartar. */
export async function resvOrigin(fromRequest = ""): Promise<string> {
  if (fromRequest) {
    const cur = await readKV<string>("resv:origin", "");
    if (cur !== fromRequest) await writeKV("resv:origin", fromRequest).catch(() => {});
  }
  return publicOrigin(fromRequest || (await readKV<string>("resv:origin", "")));
}
export const manageUrl = (origin: string, id: string) => `${origin.replace(/\/+$/, "")}/apartado/${encodeURIComponent(id)}?k=${signClientLink(id, 30)}`;
const money = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

async function branchInfo(branchId: string) {
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, address: true, latitude: true, longitude: true } });
  const map = b?.latitude != null && b?.longitude != null ? `https://maps.google.com/?q=${b.latitude},${b.longitude}` : "";
  return { name: b?.name || "", address: b?.address || "", map };
}

type ResvLike = { id: string; code: string; branchId: string; itemName: string; qty: number; total: number; clientName: string; expiresAt: Date };

export async function confirmationMessage(r: ResvLike, origin: string) {
  const s = await getSettings();
  const b = await branchInfo(r.branchId);
  return `✅ *Producto apartado* · ${s?.companyName || "Tienda"}${b.name ? ` – ${b.name}` : ""}
🛒 ${r.itemName}${r.qty > 1 ? ` × ${r.qty}` : ""} — *${money(r.total)}*
⏳ Te lo guardamos hasta el *${fmtWhen(r.expiresAt)}*${b.address ? `\n📍 ${b.address}` : ""}${b.map ? `\n🗺️ ${b.map}` : ""}

Pagas al recogerlo. Código: *${r.code}*. Ver o cancelar tu apartado:
${manageUrl(origin, r.id)}`;
}

async function endedMessage(r: ResvLike, why: "expired" | "staff" | "stock", origin: string) {
  const s = await getSettings();
  const shop = s?.companyName || "la tienda";
  const portal = origin ? `\n${origin.replace(/\/+$/, "")}/portal` : "";
  if (why === "expired") return `⌛ Hola *${r.clientName}*, tu apartado *${r.code}* (${r.itemName}) en ${shop} venció y el producto volvió a la venta. Si todavía lo quieres, puedes apartarlo de nuevo en nuestro portal:${portal}`;
  return `Hola *${r.clientName}*, lamentamos avisarte que tu apartado *${r.code}* (${r.itemName}) en ${shop} fue cancelado${why === "stock" ? " porque ya no hay unidades disponibles" : ""}. Disculpa las molestias.${portal ? `\nMira otros productos aquí:${portal}` : ""}`;
}

export async function extendedMessage(r: ResvLike) {
  const s = await getSettings();
  return `⏳ Hola *${r.clientName}*, te dimos más tiempo: tu apartado *${r.code}* (${r.itemName}) en ${s?.companyName || "la tienda"} ahora vence el *${fmtWhen(r.expiresAt)}*.`;
}

// ---------- avisos al personal ----------
export function notifyStaff(branchId: string, title: string, message: string, tag: string) {
  (async () => {
    const { managerIds, sendPush } = await import("./push");
    const ids = await managerIds(branchId);
    await prisma.notification.createMany({ data: ids.map((userId) => ({ type: "reservation", title, message, userId, branchId })) });
    await sendPush(ids, "reservations", { title, body: message, url: "/apartados", tag });
  })().catch((e) => console.error("[Apartados]", e));
}

// ---------- terminar (vencido, cancelado) y lista de espera ----------
/** Marca el apartado como terminado solo si seguía activo (evita avisar dos veces). */
async function finish(id: string, status: "expired" | "cancelled", cancelledBy?: string) {
  const r = await prisma.reservation.updateMany({ where: { id, status: "active" }, data: { status, endedAt: new Date(), ...(cancelledBy ? { cancelledBy } : {}) } });
  return r.count > 0;
}

/** Al liberarse una unidad: avisa por WhatsApp al primero de la lista de espera. */
export async function notifyWaitlist(kind: string, itemId: string) {
  const item = await loadItem(prisma as unknown as Tx, kind as ResvKind, itemId).catch(() => null);
  if (!item || (await freeUnits(prisma as unknown as Tx, item)) <= 0) return false;
  const next = await prisma.reservationWait.findFirst({ where: { kind, itemId, notifiedAt: null }, orderBy: { createdAt: "asc" } });
  if (!next) return false;
  await prisma.reservationWait.update({ where: { id: next.id }, data: { notifiedAt: new Date() } });
  const s = await getSettings();
  const origin = await resvOrigin();
  const msg = `🔔 ¡Buenas noticias${next.clientName ? `, *${next.clientName}*` : ""}! Se liberó *${item.name}* (${money(item.price)}) que querías en ${s?.companyName || "la tienda"}. Apártalo antes que otra persona:${origin ? `\n${origin.replace(/\/+$/, "")}/portal` : ""}`;
  return sendWhatsAppSafe(next.clientPhone, msg);
}

/** Cancela un apartado (cliente o personal) y avisa a la lista de espera. */
export async function cancelReservation(id: string, by: "client" | "staff" | "system") {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r || !(await finish(id, "cancelled", by))) return null;
  if (by !== "client") sendWhatsAppSafe(r.clientPhone, await endedMessage(r, by === "system" ? "stock" : "staff", await resvOrigin())).catch(() => {});
  notifyWaitlist(r.kind, r.itemId).catch(() => {});
  return r;
}

const g = globalThis as unknown as { __resvLastSweep?: number; __resvSweeping?: boolean };

/** Vence los apartados cuyo plazo pasó (se llama al consultar y cada minuto desde el reloj de tareas). */
export async function expireDue(force = false): Promise<number> {
  if (g.__resvSweeping) return 0;
  if (!force && g.__resvLastSweep && Date.now() - g.__resvLastSweep < 30_000) return 0;
  g.__resvSweeping = true;
  g.__resvLastSweep = Date.now();
  try {
    const due = await prisma.reservation.findMany({ where: { status: "active", expiresAt: { lt: new Date() } }, take: 50 });
    if (!due.length) return 0;
    const origin = await resvOrigin();
    let n = 0;
    for (const r of due) {
      if (!(await finish(r.id, "expired"))) continue;
      n++;
      await sendWhatsAppSafe(r.clientPhone, await endedMessage(r, "expired", origin));
      notifyStaff(r.branchId, `⌛ Apartado vencido · ${r.code}`, `${r.clientName} no recogió ${r.itemName}. Volvió a la venta.`, `ap-${r.id}`);
      await notifyWaitlist(r.kind, r.itemId).catch(() => {});
    }
    // La lista de espera se limpia sola a los 14 días
    await prisma.reservationWait.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
    return n;
  } finally {
    g.__resvSweeping = false;
  }
}

// ---------- lista de espera ----------
export async function joinWaitlist(input: { kind: unknown; itemId: unknown; clientName?: unknown; clientPhone: unknown }) {
  const kind = RESV_KINDS.includes(input.kind as ResvKind) ? (input.kind as ResvKind) : null;
  const itemId = typeof input.itemId === "string" ? input.itemId.slice(0, 60) : "";
  const phone = normalizePhone(input.clientPhone);
  const clientName = typeof input.clientName === "string" ? input.clientName.trim().slice(0, 80) || null : null;
  if (!kind || !itemId) throw new ResvError("Producto inválido");
  if (!phone) throw new ResvError("Escribe un celular válido (8 dígitos)");
  const item = await loadItem(prisma as unknown as Tx, kind, itemId);
  if (!item) throw new ResvError("Este producto ya no está disponible", 404);
  await prisma.reservationWait.upsert({
    where: { kind_itemId_clientPhone: { kind, itemId, clientPhone: phone } },
    create: { kind, itemId, itemName: item.name, branchId: item.branchId, clientName, clientPhone: phone },
    update: { notifiedAt: null, ...(clientName ? { clientName } : {}) },
  });
  // Si justo se liberó, el aviso sale enseguida
  notifyWaitlist(kind, itemId).catch(() => {});
  const ahead = await prisma.reservationWait.count({ where: { kind, itemId, notifiedAt: null } });
  return { position: Math.max(1, ahead) };
}

// ---------- vender ----------
/** Convierte el apartado en nota de venta (descuenta stock / marca el equipo vendido). */
export async function sellReservation(id: string, user: { id: string; name?: string | null; email?: string | null }, paidWith: "cash" | "qr" | null) {
  const moved: Moved[] = [];
  const result = await withUniqueRetry(() => prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id } });
    if (!r) throw new ResvError("Apartado no encontrado", 404);
    if (r.status !== "active") throw new ResvError(r.status === "sold" ? `Ya se vendió (${r.saleCode})` : "Este apartado ya no está activo");
    const lineKind = r.kind === "inventory" ? "inventory" : r.kind;
    const items: SaleLine[] = [{ inventoryId: r.itemId, name: r.itemName, price: r.price, qty: r.qty, kind: lineKind }];
    const n = await tx.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(MAX(CAST(REPLACE(code, 'NV-', '') AS INTEGER)), 0) AS n FROM "Quotation" WHERE "branchId" = ${r.branchId} AND "type" = 'sale' AND code ~ '^NV-[0-9]+$'`;
    const code = `NV-${Number(n[0]?.n || 0) + 1}`;
    const cost = await saleCost(tx, items);
    const userName = user.name || user.email?.split("@")[0] || "Sistema";
    const q = await tx.quotation.create({
      data: {
        code, type: "sale", clientName: r.clientName, clientPhone: r.clientPhone.replace(/^591/, ""), items: JSON.stringify(items), total: r.total,
        notes: `Apartado ${r.code} desde el portal`, paidWith, userId: user.id, branchId: r.branchId, ...cost,
      },
    });
    moved.push(...await applySaleChange(tx, r.branchId, saleEffect("quotation", []), saleEffect("sale", items), { reason: "sale", refCode: code, refId: q.id, userId: user.id, userName }));
    await tx.reservation.update({ where: { id }, data: { status: "sold", saleId: q.id, saleCode: code, endedAt: new Date() } });
    return { saleId: q.id, saleCode: code };
  }));
  alertAfter(moved);
  return result;
}

// ---------- más tiempo ----------
export async function extendReservation(id: string, hours: number) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r || r.status !== "active") throw new ResvError("Este apartado ya no está activo");
  const base = Math.max(Date.now(), r.expiresAt.getTime());
  const upd = await prisma.reservation.update({ where: { id }, data: { expiresAt: new Date(base + hours * 3600_000), extended: { increment: 1 } } });
  const whatsapp = await sendWhatsAppSafe(upd.clientPhone, await extendedMessage(upd));
  return { reservation: upd, whatsapp };
}

// Movimientos de stock en el servidor (antes los hacía el navegador, uno por uno y sin registro).
// - Cada cambio de cantidad queda en StockMovement: cuánto, por qué (venta, orden, ajuste…), con qué documento y quién.
// - Ventas y repuestos de órdenes se aplican dentro de una transacción: o se guarda todo, o nada.
// - La resta es atómica en la base de datos (UPDATE … quantity + delta), así dos ventas a la vez no pisan el stock.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;
export interface MoveCtx { reason: string; refCode?: string | null; refId?: string | null; userId?: string | null; userName?: string | null }
export interface Moved { itemId: string; prev: number; after: number }

export class StockError extends Error {
  constructor(public itemName: string, public available: number) {
    super(`Stock insuficiente: ${itemName} (hay ${available})`);
  }
}

/**
 * Aplica cambios de stock { itemId → delta }. Solo productos de esa sucursal.
 * strict: si una resta deja el stock en negativo, lanza StockError (y la transacción se deshace).
 * Sin strict, el stock no baja de 0.
 */
export async function moveStock(tx: Tx, branchId: string, changes: Map<string, number>, ctx: MoveCtx, strict = true): Promise<Moved[]> {
  const out: Moved[] = [];
  for (const [itemId, delta] of changes) {
    if (!delta) continue;
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true, quantity: true, branchId: true } });
    if (!item || item.branchId !== branchId) continue;
    let rows: { quantity: number }[];
    if (strict && delta < 0) {
      rows = await tx.$queryRaw<{ quantity: number }[]>`UPDATE "InventoryItem" SET "quantity" = "quantity" + ${delta}, "updatedAt" = NOW() WHERE "id" = ${itemId} AND "quantity" + ${delta} >= 0 RETURNING "quantity"`;
      if (!rows.length) {
        const now = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { quantity: true } });
        throw new StockError(item.name, now?.quantity ?? 0);
      }
    } else {
      rows = await tx.$queryRaw<{ quantity: number }[]>`UPDATE "InventoryItem" SET "quantity" = GREATEST(0, "quantity" + ${delta}), "updatedAt" = NOW() WHERE "id" = ${itemId} RETURNING "quantity"`;
    }
    const after = rows[0]?.quantity ?? item.quantity;
    const prev = delta < 0 && !strict ? item.quantity : after - delta;
    if (after === prev) continue;
    await tx.stockMovement.create({ data: { itemId, branchId, delta: after - prev, after, reason: ctx.reason, refCode: ctx.refCode ?? null, refId: ctx.refId ?? null, userId: ctx.userId ?? null, userName: ctx.userName ?? null } });
    out.push({ itemId, prev, after });
  }
  return out;
}

/** Registra un cambio de cantidad ya hecho (ajuste manual, números de serie, alta de producto). */
export async function logMovement(itemId: string, branchId: string, prev: number, after: number, ctx: MoveCtx) {
  if (prev === after) return;
  await prisma.stockMovement.create({ data: { itemId, branchId, delta: after - prev, after, reason: ctx.reason, refCode: ctx.refCode ?? null, refId: ctx.refId ?? null, userId: ctx.userId ?? null, userName: ctx.userName ?? null } }).catch(() => {});
}

/** Después de guardar: avisos de stock bajo para lo que bajó. */
export function alertAfter(moved: Moved[]) {
  if (!moved.length) return;
  import("./stock").then(({ afterStockChange }) => { for (const m of moved) if (m.after < m.prev) void afterStockChange(m.itemId, m.prev); }).catch(() => {});
}

export const userLabel = (u: { name?: string | null; email?: string | null }) => u.name || u.email?.split("@")[0] || "Sistema";

// ---------- ventas (notas de venta) ----------
export interface SaleLine { inventoryId: string; name?: string; price?: number; qty?: number; kind?: string; isEquipment?: boolean }
export const lineKind = (i: SaleLine) => i.kind ?? (i.isEquipment ? "equipment" : "inventory");

/** Lo que una venta saca del stock: productos (cantidad) y equipos/consolas (únicos). */
export function saleEffect(type: string, items: SaleLine[]) {
  const inv = new Map<string, number>();
  const equipment = new Set<string>(), consoles = new Set<string>();
  if (type !== "sale") return { inv, equipment, consoles };
  for (const i of items) {
    const k = lineKind(i);
    const qty = Math.max(0, Math.floor(Number(i.qty) || 0));
    if (k === "inventory" && i.inventoryId && qty) inv.set(i.inventoryId, (inv.get(i.inventoryId) || 0) + qty);
    else if (k === "equipment") equipment.add(i.inventoryId);
    else if (k === "console") consoles.add(i.inventoryId);
  }
  return { inv, equipment, consoles };
}

/**
 * Pasa de una venta "antes" a "después" (crear: antes vacío · eliminar: después vacío).
 * Ajusta stock por diferencia y marca equipos/consolas vendidos o disponibles otra vez.
 */
export async function applySaleChange(tx: Tx, branchId: string, before: ReturnType<typeof saleEffect>, after: ReturnType<typeof saleEffect>, ctx: MoveCtx): Promise<Moved[]> {
  const diff = new Map<string, number>();
  for (const [id, q] of before.inv) diff.set(id, (diff.get(id) || 0) + q);
  for (const [id, q] of after.inv) diff.set(id, (diff.get(id) || 0) - q);
  const moved = await moveStock(tx, branchId, diff, ctx, true);
  const freed = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));
  const eqSold = freed(after.equipment, before.equipment), eqFree = freed(before.equipment, after.equipment);
  const coSold = freed(after.consoles, before.consoles), coFree = freed(before.consoles, after.consoles);
  if (eqSold.length) await tx.equipment.updateMany({ where: { id: { in: eqSold }, branchId }, data: { condition: "vendido" } });
  if (eqFree.length) await tx.equipment.updateMany({ where: { id: { in: eqFree }, branchId }, data: { condition: "disponible" } });
  if (coSold.length) await tx.console.updateMany({ where: { id: { in: coSold }, branchId }, data: { condition: "vendida" } });
  if (coFree.length) await tx.console.updateMany({ where: { id: { in: coFree }, branchId }, data: { condition: "disponible" } });
  return moved;
}

/** Costo de lo vendido (para la ganancia). Incompleto si algún producto/equipo no tiene precio de compra. */
export async function saleCost(tx: Tx, items: SaleLine[]): Promise<{ costTotal: number; costComplete: boolean }> {
  let costTotal = 0, costComplete = true;
  const invIds = items.filter((i) => lineKind(i) === "inventory").map((i) => i.inventoryId);
  const costs = new Map((invIds.length ? await tx.inventoryItem.findMany({ where: { id: { in: invIds } }, select: { id: true, cost: true } }) : []).map((r) => [r.id, r.cost]));
  for (const i of items) {
    const k = lineKind(i);
    const qty = Math.max(0, Number(i.qty) || 0);
    if (k === "inventory") { const c = costs.get(i.inventoryId) || 0; if (c > 0) costTotal += c * qty; else costComplete = false; }
    else if (k === "equipment" || k === "console") costComplete = false; // equipos y consolas no tienen precio de compra cargado
  }
  return { costTotal: Math.round(costTotal * 100) / 100, costComplete };
}

// ---------- repuestos de órdenes ----------
export interface PartLine { itemId: string; name: string; qty: number; price: number; cost: number }

export function parseParts(json: string | null | undefined): PartLine[] | null {
  if (!json) return null;
  try { const a = JSON.parse(json); return Array.isArray(a) ? a.filter((p) => p && typeof p.itemId === "string" && p.qty > 0) : null; } catch { return null; }
}

/** Órdenes viejas: "Repuestos: Pantalla, Pasta térmica ×2" en las notas (ya descontados del stock). */
export async function legacyParts(tx: Tx, notes: string | null, branchId: string): Promise<PartLine[]> {
  const rep = (notes || "").split(" | ").find((p) => p.startsWith("Repuestos: "));
  if (!rep) return [];
  const names = rep.replace("Repuestos: ", "").split(", ").map((x) => x.trim()).filter(Boolean);
  if (!names.length) return [];
  const items = await tx.inventoryItem.findMany({ where: { branchId }, select: { id: true, name: true, price: true, cost: true } });
  const out = new Map<string, PartLine>();
  for (const raw of names) {
    const m = /^(.*?)\s*[×x](\d+)$/.exec(raw);
    const name = (m ? m[1] : raw).trim(), qty = m ? +m[2] : 1;
    const it = items.find((i) => i.name === name);
    if (!it) continue;
    const cur = out.get(it.id);
    out.set(it.id, cur ? { ...cur, qty: cur.qty + qty } : { itemId: it.id, name: it.name, qty, price: it.price, cost: it.cost });
  }
  return [...out.values()];
}

/**
 * Guarda los repuestos de una orden { itemId, qty }[] y ajusta el stock solo por la diferencia
 * con lo que ya tenía (las órdenes viejas toman los repuestos de sus notas, ya descontados).
 */
export async function applyRepairParts(tx: Tx, repair: { id: string; code: string; branchId: string; parts: string | null; notes: string | null }, input: unknown, ctx: Omit<MoveCtx, "reason" | "refCode" | "refId">) {
  const prev = parseParts(repair.parts) ?? (await legacyParts(tx, repair.notes, repair.branchId));
  const wanted = new Map<string, number>();
  if (Array.isArray(input)) for (const r of input) {
    const id = typeof r?.itemId === "string" ? r.itemId : null;
    const q = Math.max(0, Math.min(999, Math.floor(Number(r?.qty) || 0)));
    if (id && q) wanted.set(id, (wanted.get(id) || 0) + q);
  }
  const diff = new Map<string, number>();
  for (const p of prev) diff.set(p.itemId, (diff.get(p.itemId) || 0) + p.qty);
  for (const [id, q] of wanted) diff.set(id, (diff.get(id) || 0) - q);
  const moved = await moveStock(tx, repair.branchId, diff, { ...ctx, reason: "repair", refCode: repair.code, refId: repair.id }, true);

  const ids = [...wanted.keys()];
  const items = new Map((ids.length ? await tx.inventoryItem.findMany({ where: { id: { in: ids }, branchId: repair.branchId }, select: { id: true, name: true, price: true, cost: true } }) : []).map((i) => [i.id, i]));
  const parts: PartLine[] = [];
  for (const [id, qty] of wanted) {
    const it = items.get(id);
    const old = prev.find((p) => p.itemId === id);
    if (!it && !old) continue;
    // Se respeta el precio/costo con el que se agregó; los nuevos toman el actual
    parts.push({ itemId: id, name: it?.name || old!.name, qty, price: old?.price ?? it!.price, cost: (old?.cost || it?.cost) ?? 0 });
  }
  const partsCost = Math.round(parts.reduce((a, p) => a + p.cost * p.qty, 0) * 100) / 100;
  return { parts, partsCost, moved, missingCost: parts.some((p) => !p.cost) };
}

/** Quién hizo el movimiento (nombre para el historial). */
export async function actorOf(u: { id: string; email?: string | null }): Promise<{ userId: string; userName: string }> {
  const row = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } }).catch(() => null);
  return { userId: u.id, userName: row?.name || u.email?.split("@")[0] || "Sistema" };
}

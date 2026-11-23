// Inventario inteligente: avisos de stock bajo y lista de compra.
// - Al bajar del mínimo (cantidad ≤ mínimo): aviso en la campana, al celular y por Telegram (categoría "Stock bajo").
//   Como mucho un aviso por producto cada 12 horas.
// - Todos los días a las 8:00: resumen de lo que hay que reponer en cada sucursal (solo celular/Telegram).
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";

export interface StockItem { id: string; name: string; quantity: number; minStock: number; kind: string; branchId: string; category?: string | null }

export const isLow = (i: { quantity: number; minStock: number }) => i.minStock > 0 && i.quantity <= i.minStock;
/** Cantidad sugerida para pedir: llegar al doble del mínimo */
export const suggestedQty = (i: { quantity: number; minStock: number }) => Math.max(1, i.minStock * 2 - Math.max(0, i.quantity));

const linkOf = (kind?: string) => (kind === "part" ? "/inventory?tipo=part&compra=1" : kind === "product" ? "/inventory?tipo=product&compra=1" : "/inventory?compra=1");

export async function lowStockItems(branchId: string): Promise<StockItem[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { branchId, active: true, minStock: { gt: 0 } },
    select: { id: true, name: true, quantity: true, minStock: true, kind: true, branchId: true, category: true },
    orderBy: { name: "asc" },
  });
  return rows.filter(isLow);
}

/** Llamar después de cambiar la cantidad de un producto. Avisa solo si cruzó el mínimo hacia abajo. Nunca lanza error. */
export async function afterStockChange(itemId: string, prevQty: number) {
  try {
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { id: true, name: true, quantity: true, minStock: true, kind: true, branchId: true, active: true, branch: { select: { name: true } } } });
    if (!item || !item.active || !isLow(item) || prevQty <= item.minStock) return;
    const key = `stock:alert:${item.id}`;
    const last = await readKV<number>(key, 0);
    if (Date.now() - last < 12 * 3600_000) return;
    await writeKV(key, Date.now());

    const title = item.quantity <= 0 ? `📦 Agotado · ${item.branch.name}` : `📦 Stock bajo · ${item.branch.name}`;
    const body = item.quantity <= 0 ? `${item.name}: se terminó (mínimo ${item.minStock}).` : `${item.name}: quedan ${item.quantity} (mínimo ${item.minStock}).`;
    const managers = await prisma.user.findMany({ where: { status: "active", OR: [{ role: "superadmin" }, { role: "admin", branchId: item.branchId }] }, select: { id: true } });
    if (!managers.length) return;
    await prisma.notification.createMany({ data: managers.map((m) => ({ type: "stock", title, message: body, userId: m.id, branchId: item.branchId })) });
    const { sendPush } = await import("./push");
    await sendPush(managers.map((m) => m.id), "stock", { title, body, url: linkOf(item.kind), tag: `stock-${item.id}` });
  } catch (e) {
    console.error("[Stock]", e);
  }
}

/** Resumen diario (8:00): por sucursal, a sus administradores y a los Super Admin. */
export async function dailyStockDigest(): Promise<number> {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const { sendPush, managerIds } = await import("./push");
  let sent = 0;
  for (const b of branches) {
    const low = await lowStockItems(b.id);
    if (!low.length) continue;
    const lines = low.slice(0, 15).map((i) => `• ${i.name} — ${i.quantity}/${i.minStock}`);
    if (low.length > 15) lines.push(`• y ${low.length - 15} más`);
    sent += await sendPush(await managerIds(b.id), "stock", {
      title: `🛒 ${low.length} por reponer · ${b.name}`,
      body: lines.join("\n"),
      url: linkOf(),
      tag: `stock-digest-${b.id}`,
    });
  }
  return sent;
}

// ---------- proveedor (para enviar la lista por WhatsApp) ----------
const supplierKey = (branchId: string) => `stock:supplier:${branchId}`;
export async function getSupplier(branchId: string): Promise<{ name: string; phone: string }> {
  return { name: "", phone: "", ...(await readKV<Partial<{ name: string; phone: string }>>(supplierKey(branchId), {})) };
}
export async function saveSupplier(branchId: string, input: { name?: unknown; phone?: unknown }) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  const phone = typeof input.phone === "string" ? input.phone.replace(/[^\d+]/g, "").slice(0, 16) : "";
  await writeKV(supplierKey(branchId), { name, phone });
  return { name, phone };
}

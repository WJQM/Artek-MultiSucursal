import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// Número entero ≥ 0 o valor por defecto (antes parseInt("") daba NaN y la actualización fallaba; y minStock 0 se convertía en 5)
const toInt = (v: unknown, def: number) => { const n = parseInt(String(v)); return Number.isFinite(n) && n >= 0 ? n : def; };
const toPrice = (v: unknown, def: number) => { const n = parseFloat(String(v)); return Number.isFinite(n) && n >= 0 ? n : def; };
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, requireAdmin, canAccessBranch, forbidden, notFound } from "@/backend/auth";
import { afterStockChange } from "@/backend/stock";
import { actorOf, logMovement } from "@/backend/stock-moves";

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  const branchId = user ? getEffectiveBranchId(req, user) : null;
  try {
    const where: Prisma.InventoryItemWhereInput = { active: true };
    if (branchId) where.branchId = branchId;
    // Portal público (sin sesión): solo los productos marcados como visibles
    if (!user || user.role === "tech") where.showInPortal = true;
    // ?kind=product (Inventario) | ?kind=part (Repuestos); sin parámetro: todo (ventas, cotizaciones, entregas)
    const kind = new URL(req.url).searchParams.get("kind");
    if (kind === "product" || kind === "part") where.kind = kind;
    const items = await prisma.inventoryItem.findMany({ where, include: { branch: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
    // El precio de compra solo lo ven los administradores (no el portal ni los técnicos)
    const admin = user && (user.role === "admin" || user.role === "superadmin");
    return NextResponse.json(admin ? items : items.map(({ cost: _c, ...i }) => { void _c; return i; }));
  } catch { return NextResponse.json([], { status: 500 }); }
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });
  try {
    const { name, category, quantity, price, cost, minStock, image, showInPortal, kind } = await req.json();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    const item = await prisma.inventoryItem.create({
      data: { name, category: category || null, quantity: toInt(quantity, 0), price: toPrice(price, 0), cost: toPrice(cost, 0), minStock: toInt(minStock, 5), image: image || null, branchId, showInPortal: showInPortal !== false, kind: kind === "part" ? "part" : "product" },
    });
    if (item.quantity > 0) await logMovement(item.id, branchId, 0, item.quantity, { reason: "create", ...(await actorOf(user)) });
    return NextResponse.json(item, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear item" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, name, category, quantity, price, cost, minStock, image, active, showInPortal, kind } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.inventoryItem.findUnique({ where: { id }, select: { branchId: true, quantity: true, minStock: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }), ...(category !== undefined && { category }),
        ...(quantity !== undefined && { quantity: toInt(quantity, 0) }), ...(price !== undefined && { price: toPrice(price, 0) }), ...(cost !== undefined && { cost: toPrice(cost, 0) }),
        ...(minStock !== undefined && { minStock: toInt(minStock, 5) }), ...(image !== undefined && { image }),
        ...(active !== undefined && { active }),
        ...(typeof showInPortal === "boolean" && { showInPortal }),
        ...((kind === "part" || kind === "product") && { kind }),
      },
    });
    if (item.quantity !== owned.quantity) await logMovement(item.id, owned.branchId, owned.quantity, item.quantity, { reason: "manual", ...(await actorOf(user)) });
    // Aviso de stock bajo: si bajó la cantidad, o si se subió el mínimo y ahora quedó por debajo
    if (item.quantity < owned.quantity) void afterStockChange(item.id, owned.quantity);
    else if (item.minStock > owned.minStock && owned.quantity > owned.minStock) void afterStockChange(item.id, Infinity);
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.inventoryItem.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}

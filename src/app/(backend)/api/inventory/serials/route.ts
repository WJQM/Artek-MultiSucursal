import { errOf } from "@/shared/errors";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, requireAdmin, canAccessBranch, TokenUser } from "@/backend/auth";
import { afterStockChange } from "@/backend/stock";
import { logMovement } from "@/backend/stock-moves";

/** Cantidad = unidades disponibles; avisa si bajó del mínimo */
async function setQty(inventoryItemId: string, available: number) {
  const prev = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { quantity: true } });
  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { quantity: available } });
  if (prev && available !== prev.quantity) {
    const it = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { branchId: true } });
    if (it) await logMovement(inventoryItemId, it.branchId, prev.quantity, available, { reason: "serial" });
  }
  if (prev && available < prev.quantity) void afterStockChange(inventoryItemId, prev.quantity);
}

async function itemAllowed(user: TokenUser, inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { branchId: true } });
  return !!item && canAccessBranch(user, item.branchId);
}
const denied = () => NextResponse.json({ error: "Producto no encontrado o sin permisos" }, { status: 403 });

// GET /api/inventory/serials?inventoryId=xxx
export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const inventoryId = searchParams.get("inventoryId");
  if (!inventoryId) return NextResponse.json({ error: "inventoryId requerido" }, { status: 400 });
  if (!(await itemAllowed(user, inventoryId))) return denied();
  try {
    const serials = await prisma.serialUnit.findMany({
      where: { inventoryItemId: inventoryId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(serials);
  } catch { return NextResponse.json([], { status: 500 }); }
}

// POST — add one or many serials
export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { inventoryItemId, serials } = await req.json();
    // serials = [{ serialNumber, notes? }]
    if (!inventoryItemId || !Array.isArray(serials) || serials.length === 0)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    if (!(await itemAllowed(user, inventoryItemId))) return denied();

    const created = await Promise.all(
      serials.map((s: { serialNumber: string; notes?: string }) =>
        prisma.serialUnit.create({
          data: { serialNumber: s.serialNumber.trim(), notes: s.notes || null, inventoryItemId, status: "available" },
        })
      )
    );
    // Update item quantity to match available serials count
    const available = await prisma.serialUnit.count({ where: { inventoryItemId, status: "available" } });
    await setQty(inventoryItemId, available);

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (errOf(e).code === "P2002") return NextResponse.json({ error: "Número de serie duplicado" }, { status: 409 });
    return NextResponse.json({ error: "Error al crear serial" }, { status: 500 });
  }
}

// PATCH — mark as sold or restore
export async function PATCH(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, status, soldTo, saleCode } = await req.json();
    if (!["available", "sold", "reserved", "defective"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    const current = await prisma.serialUnit.findUnique({ where: { id }, select: { inventoryItemId: true } });
    if (!current || !(await itemAllowed(user, current.inventoryItemId))) return denied();
    const serial = await prisma.serialUnit.update({
      where: { id },
      data: {
        status,
        soldTo: status === "sold" ? soldTo || null : null,
        soldAt: status === "sold" ? new Date() : null,
        repairCode: status === "sold" ? saleCode || null : null,
      },
    });
    // Sync quantity
    const inventoryItemId = serial.inventoryItemId;
    const available = await prisma.serialUnit.count({ where: { inventoryItemId, status: "available" } });
    await setQty(inventoryItemId, available);
    return NextResponse.json(serial);
  } catch { return NextResponse.json({ error: "Error al actualizar serial" }, { status: 500 }); }
}

// DELETE — remove serial (only if available)
export async function DELETE(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = await req.json();
    const serial = await prisma.serialUnit.findUnique({ where: { id } });
    if (!serial) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (!(await itemAllowed(user, serial.inventoryItemId))) return denied();
    if (serial.status === "sold") return NextResponse.json({ error: "No se puede eliminar un serial vendido" }, { status: 400 });
    await prisma.serialUnit.delete({ where: { id } });
    const available = await prisma.serialUnit.count({ where: { inventoryItemId: serial.inventoryItemId, status: "available" } });
    await setQty(serial.inventoryItemId, available);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar serial" }, { status: 500 }); }
}

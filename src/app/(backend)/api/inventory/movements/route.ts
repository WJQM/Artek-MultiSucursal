import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { requireAdmin, canAccessBranch, notFound, forbidden } from "@/backend/auth";

const REASON: Record<string, string> = {
  sale: "Venta", sale_edit: "Venta editada", sale_delete: "Venta eliminada", sale_undo: "Venta pasada a cotización", repair: "Orden",
  manual: "Ajuste manual", serial: "Números de serie", transfer: "Traspaso", create: "Alta del producto",
};

/** Historial de movimientos de un producto: ?itemId= (últimos 100) */
export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const itemId = new URL(req.url).searchParams.get("itemId") || "";
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { branchId: true, name: true, quantity: true } });
  if (!item) return notFound();
  if (!canAccessBranch(user, item.branchId)) return forbidden();
  const rows = await prisma.stockMovement.findMany({ where: { itemId }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ name: item.name, quantity: item.quantity, items: rows.map((r) => ({ ...r, label: REASON[r.reason] || r.reason })) });
}

import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { requireAdmin, getEffectiveBranchId } from "@/backend/auth";
import { getSettings } from "@/backend/company";
import { getSupplier, lowStockItems, saveSupplier, suggestedQty } from "@/backend/stock";

/** Lista de compra de la sucursal: lo que está en el mínimo o por debajo, con cantidad sugerida. */
export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  const kind = new URL(req.url).searchParams.get("kind");
  const [items, supplier, branch, s] = await Promise.all([lowStockItems(branchId), getSupplier(branchId), prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }), getSettings()]);
  return NextResponse.json({
    branch: branch?.name || "",
    company: s?.companyName || "",
    supplier,
    items: items.filter((i) => kind !== "part" && kind !== "product" ? true : i.kind === kind).map((i) => ({ ...i, suggested: suggestedQty(i) })),
  });
}

/** Guardar el proveedor de la sucursal { name, phone } */
export async function PUT(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  return NextResponse.json(await saveSupplier(branchId, await req.json().catch(() => ({}))));
}

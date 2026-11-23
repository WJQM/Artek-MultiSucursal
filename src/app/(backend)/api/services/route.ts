import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, requireAdmin, canAccessBranch, forbidden, notFound } from "@/backend/auth";

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  const branchId = user ? getEffectiveBranchId(req, user) : null;
  try {
    const where: Prisma.ServiceWhereInput = { active: true };
    if (branchId) where.branchId = branchId;
    const services = await prisma.service.findMany({ where, orderBy: { createdAt: "asc" } });
    return NextResponse.json(services);
  } catch { return NextResponse.json([], { status: 500 }); }
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });
  try {
    const { name, price, icon } = await req.json();
    if (!name || price === undefined) return NextResponse.json({ error: "Nombre y precio requeridos" }, { status: 400 });
    const service = await prisma.service.create({ data: { name, price: parseFloat(price), icon: icon || "🔧", branchId } });
    return NextResponse.json(service, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear servicio" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, name, price, icon, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.service.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    const service = await prisma.service.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(price !== undefined && { price: parseFloat(price) }), ...(icon !== undefined && { icon }), ...(active !== undefined && { active }) },
    });
    return NextResponse.json(service);
  } catch { return NextResponse.json({ error: "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.service.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, requireAdmin, canAccessBranch, forbidden, notFound } from "@/backend/auth";

/** Precio opcional: "", null o inválido → null */
function toOptionalPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}


export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  const branchId = user ? getEffectiveBranchId(req, user) : null;
  try {
    const where: Prisma.VideogameWhereInput = { active: true };
    if (branchId) where.branchId = branchId;
    if (!user || user.role === "tech") where.showInPortal = true; // portal público: solo lo marcado como visible
    const items = await prisma.videogame.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json([], { status: 500 }); }
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });
  try {
    const { name, platform, genre, description, size, minRequirements, recRequirements, language, rating, image, price } = await req.json();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    const item = await prisma.videogame.create({
      data: {
        name,
        platform: platform || null,
        genre: genre || null,
        description: description || null,
        size: size || null,
        minRequirements: minRequirements || null,
        recRequirements: recRequirements || null,
        language: language || null,
        rating: rating || null,
        image: image || null,
        price: toOptionalPrice(price),
        branchId,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const body = await req.json();
    const { id, name, platform, genre, description, size, minRequirements, recRequirements, language, rating, image, active } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.videogame.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    // Mostrar / ocultar en el portal (botón de la tarjeta)
    if (typeof body.showInPortal === "boolean" && Object.keys(body).every((k) => k === "id" || k === "showInPortal")) {
      const item = await prisma.videogame.update({ where: { id }, data: { showInPortal: body.showInPortal } });
      return NextResponse.json(item);
    }
    const item = await prisma.videogame.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(platform !== undefined && { platform }),
        ...(genre !== undefined && { genre }),
        ...(description !== undefined && { description }),
        ...(size !== undefined && { size }),
        ...(minRequirements !== undefined && { minRequirements }),
        ...(recRequirements !== undefined && { recRequirements }),
        ...(language !== undefined && { language }),
        ...(rating !== undefined && { rating }),
        ...(image !== undefined && { image }),
        ...(body.price !== undefined && { price: toOptionalPrice(body.price) }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.videogame.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    await prisma.videogame.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withUniqueRetry } from "@/backend/unique-retry";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, requireAdmin, canAccessBranch, forbidden, notFound } from "@/backend/auth";

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  const branchId = user ? getEffectiveBranchId(req, user) : null;
  try {
    const where: Prisma.ConsoleWhereInput = { active: true };
    if (branchId) where.branchId = branchId;
    if (!user) where.showInPortal = true; // portal público: solo lo marcado como visible
    const items = await prisma.console.findMany({
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
    const { name, category, state, brand, model, color, storage, generation, accessories, condition, price, notes, image } = await req.json();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

    // Reintenta con el siguiente número si otra persona tomó el mismo código a la vez
    const item = await withUniqueRetry(async () => {
      // Generar código CN-N secuencial por sucursal
      const existingConsoles = await prisma.console.findMany({
        where: { branchId },
        select: { code: true },
      });
      const usedNumbers = existingConsoles
        .map(c => c.code)
        .filter(c => /^CN-\d+$/.test(c))
        .map(c => parseInt(c.replace("CN-", ""), 10))
        .filter(n => !isNaN(n));
      const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
      const code = `CN-${nextNumber}`;

      return await prisma.console.create({
        data: {
          code,
          name,
          category: category || null,
          state: state || null,
          brand: brand || null,
          model: model || null,
          color: color || null,
          storage: storage || null,
          generation: generation || null,
          accessories: accessories || null,
          condition: condition || "disponible",
          price: typeof price === "number" ? price : parseFloat(price) || 0,
          notes: notes || null,
          image: image || null,
          branchId,
        },
      });
    });
    return NextResponse.json(item, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  try {
    const body = await req.json();
    const { id, name, category, state, brand, model, color, storage, generation, accessories, condition, price, notes, image, active } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const owned = await prisma.console.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    // Mostrar / ocultar en el portal (botón de la tarjeta)
    if (typeof body.showInPortal === "boolean" && Object.keys(body).every((k) => k === "id" || k === "showInPortal")) {
      const item = await prisma.console.update({ where: { id }, data: { showInPortal: body.showInPortal } });
      return NextResponse.json(item);
    }
    const item = await prisma.console.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(state !== undefined && { state }),
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(color !== undefined && { color }),
        ...(storage !== undefined && { storage }),
        ...(generation !== undefined && { generation }),
        ...(accessories !== undefined && { accessories }),
        ...(condition !== undefined && { condition }),
        ...(price !== undefined && { price: typeof price === "number" ? price : parseFloat(price) || 0 }),
        ...(notes !== undefined && { notes }),
        ...(image !== undefined && { image }),
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
    const owned = await prisma.console.findUnique({ where: { id }, select: { branchId: true } });
    if (!owned) return notFound();
    if (!canAccessBranch(user, owned.branchId)) return forbidden();
    await prisma.console.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}

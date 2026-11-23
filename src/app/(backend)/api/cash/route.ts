import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId, canAccessBranch, forbidden, notFound } from "@/backend/auth";
import * as D from "@/shared/dates";

// GET /api/cash — listar movimientos con filtros opcionales ?from=&to=&type=&category=
export async function GET(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role === "tech") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const branchId = getEffectiveBranchId(request, user);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const category = url.searchParams.get("category");

    const where: Prisma.CashMovementWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (type) where.type = type;
    if (category) where.category = category;
    // Fechas "YYYY-MM-DD" interpretadas en hora de Bolivia (antes se tomaban en UTC)
    const fromDate = D.parseLocalDate(from);
    const toDate = D.parseLocalDate(to);
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lt = D.addDays(toDate, 1); // incluye el día completo
    }

    // Sumas por tipo calculadas en la base (antes solo contaban los últimos 500 movimientos)
    const sumByType = async (w: Prisma.CashMovementWhereInput) => {
      const rows = await prisma.cashMovement.groupBy({ by: ["type"], where: w, _sum: { amount: true } });
      const get = (t: string) => Number(rows.find(r => r.type === t)?._sum.amount || 0);
      return { income: get("income"), expense: get("expense") };
    };

    const branchWhere = branchId ? { branchId } : {};
    const [movements, filtered, today, month] = await Promise.all([
      prisma.cashMovement.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      sumByType(where),
      sumByType({ ...branchWhere, createdAt: { gte: D.startOfDay() } }),
      sumByType({ ...branchWhere, createdAt: { gte: D.startOfMonth() } }),
    ]);
    const totalIncome = filtered.income;
    const totalExpense = filtered.expense;
    const balance = totalIncome - totalExpense;

    return NextResponse.json({
      movements,
      summary: { totalIncome, totalExpense, balance },
      today: { ...today, balance: today.income - today.expense },
      month: { ...month, balance: month.income - month.expense },
    });
  } catch (error) {
    console.error("[Cash] GET Error:", error);
    return NextResponse.json({ error: "Error al cargar movimientos" }, { status: 500 });
  }
}

// POST /api/cash — crear movimiento
export async function POST(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role === "tech") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await request.json();
    if (!body.type || !["income", "expense"].includes(body.type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (!body.amount || !isFinite(Number(body.amount)) || Number(body.amount) <= 0 || Number(body.amount) > 10_000_000) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }
    if (!body.description || !body.description.trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    const branchId = getEffectiveBranchId(request, user) || user.branchId;
    if (!branchId) return NextResponse.json({ error: "Sucursal no definida" }, { status: 400 });
    if (!canAccessBranch(user, branchId)) return forbidden();

    const movement = await prisma.cashMovement.create({
      data: {
        type: body.type,
        category: body.category || "otros",
        amount: Number(body.amount),
        description: body.description.trim().substring(0, 300),
        notes: body.notes ? String(body.notes).substring(0, 500) : null,
        createdBy: user.id,
        createdByName: user.email?.split("@")[0] || "Usuario",
        branchId,
      },
    });

    return NextResponse.json(movement);
  } catch (error) {
    console.error("[Cash] POST Error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

// DELETE /api/cash?id=xxx — borrar movimiento (solo admin/superadmin)
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role === "tech") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const existing = await prisma.cashMovement.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return notFound();
    if (!canAccessBranch(user, existing.branchId)) return forbidden();

    await prisma.cashMovement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Cash] DELETE Error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

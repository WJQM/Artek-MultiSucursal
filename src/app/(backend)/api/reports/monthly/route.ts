import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";
import * as D from "@/shared/dates";

// GET /api/reports/monthly?year=2026&month=4 — datos del mes
export async function GET(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const branchId = getEffectiveBranchId(request, user);
    const url = new URL(request.url);
    const today = D.zonedParts();
    let year = parseInt(url.searchParams.get("year") || String(today.y));
    let month = parseInt(url.searchParams.get("month") || String(today.m));
    if (!(year >= 2000 && year <= 2100)) year = today.y;
    if (!(month >= 1 && month <= 12)) month = today.m;

    // Mes completo en hora de Bolivia
    const { start, end } = D.monthRange(year, month);

    const where: { createdAt: { gte: Date; lt: Date }; branchId?: string } = { createdAt: { gte: start, lt: end } };
    if (branchId) where.branchId = branchId;
    const deliveredWhere: Prisma.RepairWhereInput = { status: "delivered", deliveredAt: { gte: start, lt: end } };
    if (branchId) deliveredWhere.branchId = branchId;

    const [repairs, deliveredRepairs, quotations, branch] = await Promise.all([
      // OTs recibidas en el mes
      prisma.repair.findMany({
        where,
        orderBy: { createdAt: "asc" },
        include: { technician: { select: { id: true, name: true } }, branch: { select: { name: true } } },
      }),
      // OTs entregadas en el mes (aunque hayan ingresado antes) → ingresos
      prisma.repair.findMany({
        where: deliveredWhere,
        orderBy: { deliveredAt: "asc" },
        include: { technician: { select: { id: true, name: true } } },
      }),
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: "asc" },
      }),
      branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null,
    ]);

    // Totales por estado
    const byStatus: Record<string, number> = {};
    for (const r of repairs) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    // Ingresos por OTs entregadas en el mes
    const repairIncome = deliveredRepairs.reduce((s, r) => s + (Number(r.estimatedCost) || 0), 0);

    // Ingresos por ventas
    const sales = quotations.filter(q => q.type === "sale");
    const cots = quotations.filter(q => q.type === "quotation");
    const salesIncome = sales.reduce((s, q) => s + (Number(q.total) || 0), 0);

    // Desglose por técnico (solo delivered)
    const byTech: Record<string, { id: string; name: string; count: number; income: number }> = {};
    for (const r of deliveredRepairs) {
      const tid = r.technicianId || "sin";
      const tname = r.technician?.name || "Sin técnico";
      if (!byTech[tid]) byTech[tid] = { id: tid, name: tname, count: 0, income: 0 };
      byTech[tid].count++;
      byTech[tid].income += Number(r.estimatedCost) || 0;
    }

    return NextResponse.json({
      period: { year, month, label: start.toLocaleDateString("es-BO", { month: "long", year: "numeric", timeZone: D.APP_TZ }) },
      branchName: branch?.name || "Todas las sucursales",
      repairs: repairs.map(r => ({
        code: r.code,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        device: [r.device, r.brand, r.model].filter(Boolean).join(" "),
        status: r.status,
        technicianName: r.technician?.name || null,
        estimatedCost: r.estimatedCost,
        createdAt: r.createdAt,
        deliveredAt: r.deliveredAt,
      })),
      delivered: deliveredRepairs.map(r => ({
        code: r.code,
        clientName: r.clientName,
        device: [r.device, r.brand, r.model].filter(Boolean).join(" "),
        technicianName: r.technician?.name || null,
        estimatedCost: r.estimatedCost,
        deliveredAt: r.deliveredAt,
      })),
      quotations: quotations.map(q => ({
        code: q.code,
        type: q.type,
        clientName: q.clientName,
        total: q.total,
        createdAt: q.createdAt,
      })),
      summary: {
        totalRepairs: repairs.length,
        byStatus,
        deliveredCount: deliveredRepairs.length,
        repairIncome,
        salesCount: sales.length,
        salesIncome,
        quotationsCount: cots.length,
        totalIncome: repairIncome + salesIncome,
      },
      byTechnician: Object.values(byTech).sort((a, b) => b.income - a.income),
    });
  } catch (error) {
    console.error("[Report] Error:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}

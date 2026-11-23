// Rendimiento por técnico: órdenes terminadas, tiempos, reingresos por garantía, calificación, ingresos y ganancia.
// Los tiempos salen del historial de estados (StatusHistory) de cada orden.
import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export const STAGES = ["pending", "diagnosed", "waiting_parts", "in_progress"] as const;
const H = 3_600_000;

export interface TechRow {
  id: string; name: string;
  finished: number; active: number;
  avgTurnaroundH: number | null; avgDiagnosisH: number | null;
  warranty: number; warrantyRate: number;
  rating: number | null; ratingCount: number;
  income: number; partsCost: number; profit: number; deliveredCount: number;
}

export async function technicianPerformance(branchId: string | null, from: Date, to: Date) {
  const w = branchId ? { branchId } : {};
  const techs = await prisma.user.findMany({ where: { role: "tech", status: "active", ...(branchId ? { branchId } : {}) }, select: { id: true, name: true } });
  // Órdenes que se terminaron (pasaron a Completado) en el período
  const doneHist = await prisma.statusHistory.findMany({ where: { toStatus: "completed", createdAt: { gte: from, lt: to } }, select: { repairId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const doneAt = new Map<string, Date>();
  for (const h of doneHist) if (!doneAt.has(h.repairId)) doneAt.set(h.repairId, h.createdAt);
  const doneRepairs = doneAt.size ? await prisma.repair.findMany({ where: { ...w, id: { in: [...doneAt.keys()] } }, select: { id: true, code: true, branchId: true, technicianId: true, createdAt: true } }) : [];
  const diagHist = doneRepairs.length ? await prisma.statusHistory.findMany({ where: { repairId: { in: doneRepairs.map((r) => r.id) }, toStatus: { not: "pending" } }, select: { repairId: true, createdAt: true }, orderBy: { createdAt: "asc" } }) : [];
  const firstMove = new Map<string, Date>();
  for (const h of diagHist) if (!firstMove.has(h.repairId)) firstMove.set(h.repairId, h.createdAt);

  // Entregadas en el período (ingresos y ganancia)
  const delivered = await prisma.repair.findMany({ where: { ...w, status: "delivered", deliveredAt: { gte: from, lt: to } }, select: { id: true, code: true, branchId: true, technicianId: true, estimatedCost: true, partsCost: true } });
  // Reingresos por garantía creados en el período → técnico de la orden original
  const warrantyNew = await prisma.repair.findMany({ where: { ...w, warrantyOf: { not: null }, createdAt: { gte: from, lt: to } }, select: { warrantyOf: true, branchId: true } });
  const origCodes = [...new Set(warrantyNew.map((r) => `${r.branchId}|${r.warrantyOf}`))];
  const origs = origCodes.length ? await prisma.repair.findMany({ where: { OR: origCodes.map((k) => { const [b, c] = k.split("|"); return { branchId: b, code: c }; }) }, select: { code: true, branchId: true, technicianId: true } }) : [];
  const origTech = new Map(origs.map((o) => [`${o.branchId}|${o.code}`, o.technicianId]));
  // Reseñas del período
  const reviews = await prisma.review.findMany({ where: { ...w, createdAt: { gte: from, lt: to } }, select: { repairId: true, rating: true } });
  const revRepairs = reviews.length ? await prisma.repair.findMany({ where: { id: { in: reviews.map((r) => r.repairId) } }, select: { id: true, technicianId: true } }) : [];
  const revTech = new Map(revRepairs.map((r) => [r.id, r.technicianId]));
  const active = await prisma.repair.groupBy({ by: ["technicianId"], where: { ...w, status: { in: ["pending", "diagnosed", "waiting_parts", "in_progress"] }, technicianId: { not: null } }, _count: { _all: true } });

  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  const rows: TechRow[] = [...techs, { id: "", name: "Sin asignar" }].map((t) => {
    const tid = t.id || null;
    const mine = doneRepairs.filter((r) => r.technicianId === tid);
    const turn = mine.map((r) => (doneAt.get(r.id)!.getTime() - r.createdAt.getTime()) / H).filter((x) => x >= 0);
    const diag = mine.map((r) => firstMove.get(r.id)).map((d, i) => (d ? (d.getTime() - mine[i].createdAt.getTime()) / H : null)).filter((x): x is number => x !== null && x >= 0);
    const del = delivered.filter((r) => r.technicianId === tid);
    const income = del.reduce((a, r) => a + r.estimatedCost, 0);
    const partsCost = del.reduce((a, r) => a + (r.partsCost || 0), 0);
    const warranty = warrantyNew.filter((r) => origTech.get(`${r.branchId}|${r.warrantyOf}`) === tid).length;
    const rs = reviews.filter((r) => revTech.get(r.repairId) === tid).map((r) => r.rating);
    return {
      id: t.id, name: t.name, finished: mine.length, active: active.find((a) => a.technicianId === tid)?._count._all || 0,
      avgTurnaroundH: avg(turn), avgDiagnosisH: avg(diag),
      warranty, warrantyRate: mine.length ? Math.round((warranty / mine.length) * 1000) / 10 : 0,
      rating: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null, ratingCount: rs.length,
      income: Math.round(income), partsCost: Math.round(partsCost), profit: Math.round(income - partsCost), deliveredCount: del.length,
    };
  }).filter((r) => r.id || r.finished || r.deliveredCount || r.active);

  // Dónde se demoran las órdenes: tiempo promedio en cada estado (transiciones dentro del período)
  // Con sucursal se une con Repair en la base (antes se mandaba la lista de IDs, que con muchas órdenes
  // pasaba el límite de parámetros de PostgreSQL y la pantalla daba error)
  const since = new Date(from.getTime() - 60 * 86_400_000);
  const stageHist = await prisma.$queryRaw<{ repairId: string; fromStatus: string | null; toStatus: string; createdAt: Date }[]>`
    SELECT h."repairId", h."fromStatus", h."toStatus", h."createdAt"
    FROM "StatusHistory" h
    ${branchId ? Prisma.sql`JOIN "Repair" r ON r.id = h."repairId" AND r."branchId" = ${branchId} AND r."updatedAt" >= ${from}` : Prisma.empty}
    WHERE h."createdAt" >= ${since} AND h."createdAt" < ${to}
    ORDER BY h."createdAt" ASC`;
  const byRepair = new Map<string, typeof stageHist>();
  for (const h of stageHist) byRepair.set(h.repairId, [...(byRepair.get(h.repairId) || []), h]);
  const stageTimes: Record<string, number[]> = Object.fromEntries(STAGES.map((s) => [s, []]));
  for (const list of byRepair.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      const st = list[i].toStatus, next = list[i + 1];
      if (next.createdAt < from) continue;
      const dt = (next.createdAt.getTime() - list[i].createdAt.getTime()) / H;
      if (st in stageTimes && dt >= 0) stageTimes[st].push(dt);
    }
  }
  const stages = STAGES.map((s) => ({ status: s, avgH: avg(stageTimes[s]), samples: stageTimes[s].length }));
  return { rows: rows.sort((a, b) => b.finished - a.finished || b.income - a.income), stages };
}

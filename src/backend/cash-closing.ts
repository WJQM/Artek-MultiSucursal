// Cierre de caja: cuánto efectivo DEBERÍA haber al final del día y comparación con lo contado.
// Debería haber = fondo inicial (lo que se dejó en el cierre anterior)
//               + entregas cobradas en efectivo + ventas en efectivo + otros ingresos de caja − gastos de caja.
// Lo cobrado por QR va al banco: se muestra aparte para revisarlo en el banco, no en la caja.
import { prisma } from "./prisma";
import * as D from "@/shared/dates";

export interface ClosingCalc {
  day: string; label: string;
  openingFloat: number; openingFrom: string | null;
  cashRepairs: number; cashRepairsCount: number;
  cashSales: number; cashSalesCount: number;
  cashIn: number; cashOut: number;
  qrTotal: number; qrCount: number;
  expected: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function dayRange(day: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const start = D.zonedMidnight(+m[1], +m[2], +m[3]);
  return { start, end: D.addDays(start, 1) };
}

export async function computeClosing(branchId: string, day: string): Promise<ClosingCalc | null> {
  const range = dayRange(day);
  if (!range) return null;
  const { start, end } = range;
  const w = { branchId };
  const prev = await prisma.cashClosing.findFirst({ where: { branchId, day: { lt: day } }, orderBy: { day: "desc" }, select: { day: true, leftInCash: true } });
  const [repCash, repQr, nvCash, nvQr, cin, cout] = await Promise.all([
    // Sin indicar = efectivo (como en el resumen del día)
    prisma.repair.aggregate({ _sum: { estimatedCost: true }, _count: { _all: true }, where: { ...w, status: "delivered", deliveredAt: { gte: start, lt: end }, NOT: { paidWith: "qr" } } }),
    prisma.repair.aggregate({ _sum: { estimatedCost: true }, _count: { _all: true }, where: { ...w, status: "delivered", deliveredAt: { gte: start, lt: end }, paidWith: "qr" } }),
    prisma.quotation.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...w, type: "sale", createdAt: { gte: start, lt: end }, NOT: { paidWith: "qr" } } }),
    prisma.quotation.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...w, type: "sale", createdAt: { gte: start, lt: end }, paidWith: "qr" } }),
    prisma.cashMovement.aggregate({ _sum: { amount: true }, where: { ...w, type: "income", createdAt: { gte: start, lt: end } } }),
    prisma.cashMovement.aggregate({ _sum: { amount: true }, where: { ...w, type: "expense", createdAt: { gte: start, lt: end } } }),
  ]);
  // Prisma: NOT { paidWith: "qr" } excluye también los null → se suman aparte
  const [repNull, nvNull] = await Promise.all([
    prisma.repair.aggregate({ _sum: { estimatedCost: true }, _count: { _all: true }, where: { ...w, status: "delivered", deliveredAt: { gte: start, lt: end }, paidWith: null } }),
    prisma.quotation.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...w, type: "sale", createdAt: { gte: start, lt: end }, paidWith: null } }),
  ]);
  const cashRepairs = Number(repCash._sum.estimatedCost || 0) + Number(repNull._sum.estimatedCost || 0);
  const cashSales = Number(nvCash._sum.total || 0) + Number(nvNull._sum.total || 0);
  const cashIn = Number(cin._sum.amount || 0), cashOut = Number(cout._sum.amount || 0);
  const openingFloat = prev?.leftInCash ?? 0;
  const label = new Date(start.getTime() + 12 * 3600_000).toLocaleDateString("es-BO", { timeZone: D.APP_TZ, weekday: "long", day: "numeric", month: "long" });
  return {
    day, label: label.charAt(0).toUpperCase() + label.slice(1),
    openingFloat, openingFrom: prev?.day ?? null,
    cashRepairs: r2(cashRepairs), cashRepairsCount: repCash._count._all + repNull._count._all,
    cashSales: r2(cashSales), cashSalesCount: nvCash._count._all + nvNull._count._all,
    cashIn: r2(cashIn), cashOut: r2(cashOut),
    qrTotal: r2(Number(repQr._sum.estimatedCost || 0) + Number(nvQr._sum.total || 0)), qrCount: repQr._count._all + nvQr._count._all,
    expected: r2(openingFloat + cashRepairs + cashSales + cashIn - cashOut),
  };
}

export const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

export function closingText(c: { day: string; expected: number; counted: number; difference: number; leftInCash: number; withdrawn: number; qrTotal: number; qrVerified: boolean; notes: string | null; userName: string | null }, branch: string, company: string, label: string) {
  const bs = (n: number) => `Bs. ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const diff = c.difference === 0 ? "✅ Cuadra exacto" : c.difference < 0 ? `🔴 *Faltan ${bs(-c.difference)}*` : `🟡 *Sobran ${bs(c.difference)}*`;
  return `🔒 *Cierre de caja* · ${company}${branch ? ` – ${branch}` : ""}
📅 ${label}

Debería haber: ${bs(c.expected)}
Contado: ${bs(c.counted)}
${diff}

Se deja en caja: ${bs(c.leftInCash)} · Se retira: ${bs(c.withdrawn)}
📱 Por QR (banco): ${bs(c.qrTotal)}${c.qrVerified ? " ✔ revisado" : " — sin revisar"}${c.notes ? `\n📝 ${c.notes}` : ""}
👤 Cerró: ${c.userName || "—"}`;
}

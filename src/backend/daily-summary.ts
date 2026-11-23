// Resumen del día: ingresos, movimiento de órdenes y lo pendiente para mañana.
import { prisma } from "./prisma";
import * as D from "@/shared/dates";
import { getSettings } from "./company";
import { getAutomationConfig } from "./automation";
import { sendWhatsAppSafe } from "./whatsapp";
import { warnAfter } from "./uncollected";

export interface DaySummary {
  date: string;             // YYYY-MM-DD (hora del negocio)
  dateLabel: string;        // "Jueves 1 de octubre"
  branchName: string | null;
  /** cash = movimientos de caja chica; qr = cobrado por QR (entregas + ventas); inHand = lo que debería haber en efectivo */
  income: { repairs: number; sales: number; cash: number; total: number; qr: number; inHand: number };
  expense: number;
  received: number;         // OT registradas hoy
  delivered: number;        // OT entregadas hoy
  salesCount: number;       // NV de hoy
  quotesCount: number;      // COT de hoy
  pending: { ready: number; abandoning: number; inProgress: number; waitingParts: number; pending: number; quotesExpiring: number };
}

const QUOTE_DAYS = 15; // validez de la cotización (ver hoja de la COT)

export async function buildDaySummary(branchId: string | null, now = new Date()): Promise<DaySummary> {
  const start = D.startOfDay(now);
  const end = D.addDays(start, 1);
  const w = branchId ? { branchId } : {};
  const sumCash = async (type: string) => Number((await prisma.cashMovement.aggregate({ _sum: { amount: true }, where: { ...w, type, createdAt: { gte: start, lt: end } } }))._sum.amount || 0);
  // COT que vencen mañana: emitidas hace QUOTE_DAYS-1 días
  const qStart = D.addDays(start, -(QUOTE_DAYS - 1));
  const qEnd = D.addDays(qStart, 1);
  const s = await getSettings();
  const abandonDays = s?.abandonDays ?? 90;

  const [repQr, nvQr] = await Promise.all([
    prisma.repair.aggregate({ _sum: { estimatedCost: true }, where: { ...w, status: "delivered", paidWith: "qr", deliveredAt: { gte: start, lt: end } } }),
    prisma.quotation.aggregate({ _sum: { total: true }, where: { ...w, type: "sale", paidWith: "qr", createdAt: { gte: start, lt: end } } }),
  ]);
  const qr = Number(repQr._sum.estimatedCost || 0) + Number(nvQr._sum.total || 0);
  const [rep, nv, cashIn, cashOut, received, delivered, quotes, byStatus, quotesExpiring, branch, readyHist] = await Promise.all([
    prisma.repair.aggregate({ _sum: { estimatedCost: true }, where: { ...w, status: "delivered", deliveredAt: { gte: start, lt: end } } }),
    prisma.quotation.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...w, type: "sale", createdAt: { gte: start, lt: end } } }),
    sumCash("income"),
    sumCash("expense"),
    prisma.repair.count({ where: { ...w, createdAt: { gte: start, lt: end } } }),
    prisma.repair.count({ where: { ...w, status: "delivered", deliveredAt: { gte: start, lt: end } } }),
    prisma.quotation.count({ where: { ...w, type: "quotation", createdAt: { gte: start, lt: end } } }),
    prisma.repair.groupBy({ by: ["status"], where: w, _count: { _all: true } }),
    prisma.quotation.count({ where: { ...w, type: "quotation", createdAt: { gte: qStart, lt: qEnd } } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null,
    prisma.repair.findMany({ where: { ...w, status: "completed" }, select: { id: true, updatedAt: true } }),
  ]);
  const count = (st: string) => byStatus.find((x) => x.status === st)?._count._all || 0;
  // Por abandonar (misma regla que el panel)
  let abandoning = 0;
  if (readyHist.length) {
    const hist = await prisma.statusHistory.findMany({ where: { repairId: { in: readyHist.map((r) => r.id) }, toStatus: "completed" }, select: { repairId: true, createdAt: true }, orderBy: { createdAt: "desc" } });
    const m = new Map<string, Date>();
    for (const h of hist) if (!m.has(h.repairId)) m.set(h.repairId, h.createdAt);
    const lim = warnAfter(abandonDays);
    abandoning = readyHist.filter((r) => (now.getTime() - (m.get(r.id) || r.updatedAt).getTime()) / 86_400_000 >= lim).length;
  }
  const repairs = Number(rep._sum.estimatedCost || 0);
  const sales = Number(nv._sum.total || 0);
  const p = D.zonedParts(now);
  const label = now.toLocaleDateString("es-BO", { timeZone: D.APP_TZ, weekday: "long", day: "numeric", month: "long" });
  return {
    date: `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`,
    dateLabel: label.charAt(0).toUpperCase() + label.slice(1),
    branchName: branch?.name ?? null,
    income: { repairs, sales, cash: cashIn, total: repairs + sales + cashIn, qr, inHand: repairs + sales + cashIn - qr },
    expense: cashOut,
    received, delivered, salesCount: nv._count._all, quotesCount: quotes,
    pending: { ready: count("completed"), abandoning, inProgress: count("in_progress") + count("diagnosed"), waitingParts: count("waiting_parts"), pending: count("pending"), quotesExpiring },
  };
}

const bs = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

export function summaryText(s: DaySummary, companyName: string): string {
  const lines = [
    `📊 *Resumen del día · ${s.dateLabel}*`,
    `${companyName}${s.branchName ? ` — ${s.branchName}` : ""}`,
    "",
    `💰 Ingresos: *${bs(s.income.total)}*`,
    `   🔧 Reparaciones ${bs(s.income.repairs)} · 🧾 Ventas ${bs(s.income.sales)}${s.income.cash ? ` · 💵 Caja ${bs(s.income.cash)}` : ""}`,
    ...(s.income.qr > 0 ? [`   💵 Efectivo ${bs(s.income.inHand)} · 📱 QR ${bs(s.income.qr)}`] : []),
    `💸 Egresos: ${bs(s.expense)}`,
    "",
    `📥 Recibidos: ${s.received}`,
    `📱 Entregados: ${s.delivered}`,
    `🧾 Ventas: ${s.salesCount}${s.quotesCount ? ` · Cotizaciones: ${s.quotesCount}` : ""}`,
  ];
  const t = s.pending;
  const tomorrow = [
    t.ready ? `${t.ready} listo${t.ready > 1 ? "s" : ""} sin recoger${t.abandoning ? ` (${t.abandoning} por abandonar)` : ""}` : "",
    t.inProgress ? `${t.inProgress} en trabajo` : "",
    t.waitingParts ? `${t.waitingParts} esperando repuesto` : "",
    t.pending ? `${t.pending} por revisar` : "",
    t.quotesExpiring ? `${t.quotesExpiring} cotización${t.quotesExpiring > 1 ? "es vencen" : " vence"} mañana` : "",
  ].filter(Boolean);
  if (tomorrow.length) lines.push("", `📌 Para mañana: ${tomorrow.join(", ")}`);
  return lines.join("\n");
}

/** Tarea de la noche: manda el resumen (una sección por sucursal) al WhatsApp del dueño. */
export async function sendDailySummaries() {
  const cfg = await getAutomationConfig();
  if (!cfg.ownerPhone) return false;
  const s = await getSettings();
  const company = s?.companyName || "RepairTrackQR";
  const branches = await prisma.branch.findMany({ where: { active: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const parts: string[] = [];
  if (branches.length <= 1) parts.push(summaryText(await buildDaySummary(branches[0]?.id ?? null), company));
  else {
    for (const b of branches) parts.push(summaryText(await buildDaySummary(b.id), company));
    const all = await buildDaySummary(null);
    parts.push(`🏢 *Total de todas las sucursales:* ${bs(all.income.total)} de ingresos · ${all.delivered} entregados · ${all.received} recibidos`);
  }
  const text = parts.join("\n\n———\n\n");
  const sent = await sendWhatsAppSafe(cfg.ownerPhone, text);
  if (!sent) {
    // Respaldo: si el WhatsApp del taller falla, el resumen llega por Telegram a los Super Admin vinculados
    const { telegramToOwners } = await import("./telegram");
    await telegramToOwners("⚠️ No se pudo enviar el resumen por WhatsApp — va por aquí", text.replace(/\*/g, "")).catch(() => 0);
  }
  return sent;
}

import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden, isAdmin, getEffectiveBranchId, canAccessBranch } from "@/backend/auth";
import { getSettings } from "@/backend/company";
import { getAutomationConfig } from "@/backend/automation";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { todayISO } from "@/shared/dates";
import { actorOf } from "@/backend/stock-moves";
import { closingText, computeClosing, DENOMINATIONS } from "@/backend/cash-closing";

/** Días que se pueden cerrar: hoy y hasta 7 días atrás (si se olvidó cerrar). */
function validDay(day: string | null): string | null {
  const today = todayISO();
  const d = day || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return null;
  const diff = (Date.parse(today) - Date.parse(d)) / 86_400_000;
  return diff <= 7 ? d : null;
}

async function ctx(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return { error: unauthorized() };
  if (!isAdmin(user)) return { error: forbidden("Solo administradores") };
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return { error: NextResponse.json({ error: "Elige una sucursal para cerrar su caja" }, { status: 400 }) };
  return { user, branchId };
}

/** ?day=AAAA-MM-DD → cálculo del día, el cierre si ya existe e historial del último mes */
export async function GET(request: Request) {
  const c = await ctx(request);
  if ("error" in c) return c.error;
  const day = validDay(new URL(request.url).searchParams.get("day"));
  if (!day) return NextResponse.json({ error: "Solo se puede cerrar hoy o hasta 7 días atrás" }, { status: 400 });
  const [calc, closing, history] = await Promise.all([
    computeClosing(c.branchId, day),
    prisma.cashClosing.findUnique({ where: { branchId_day: { branchId: c.branchId, day } } }),
    prisma.cashClosing.findMany({ where: { branchId: c.branchId }, orderBy: { day: "desc" }, take: 31 }),
  ]);
  const monthDiff = history.filter((h) => h.day.slice(0, 7) === day.slice(0, 7)).reduce((a, h) => a + h.difference, 0);
  return NextResponse.json({ calc, closing, history, monthDiff: Math.round(monthDiff * 100) / 100, denominations: DENOMINATIONS, canReopen: c.user.role === "superadmin" });
}

/** Cerrar { day, counted?, denominations?, leftInCash, notes, qrVerified } */
export async function POST(request: Request) {
  const c = await ctx(request);
  if ("error" in c) return c.error;
  const b = await request.json().catch(() => ({}));
  const day = validDay(typeof b.day === "string" ? b.day : null);
  if (!day) return NextResponse.json({ error: "Solo se puede cerrar hoy o hasta 7 días atrás" }, { status: 400 });
  const exists = await prisma.cashClosing.findUnique({ where: { branchId_day: { branchId: c.branchId, day } } });
  if (exists) return NextResponse.json({ error: "Este día ya está cerrado" }, { status: 409 });
  const calc = (await computeClosing(c.branchId, day))!;

  // Lo contado: por billete (si se mandó) o el total directo
  let counted = Number(b.counted);
  let denominations: string | null = null;
  if (b.denominations && typeof b.denominations === "object") {
    const clean: Record<string, number> = {};
    let sum = 0;
    for (const v of DENOMINATIONS) {
      const n = Math.max(0, Math.min(100000, Math.floor(Number((b.denominations as Record<string, unknown>)[String(v)]) || 0)));
      if (n) { clean[String(v)] = n; sum += n * v; }
    }
    if (Object.keys(clean).length) { denominations = JSON.stringify(clean); counted = sum; }
  }
  if (!Number.isFinite(counted) || counted < 0 || counted > 10_000_000) return NextResponse.json({ error: "Escribe cuánto efectivo contaste" }, { status: 400 });
  counted = Math.round(counted * 100) / 100;
  const leftInCash = Math.round(Math.max(0, Math.min(counted, Number(b.leftInCash) || 0)) * 100) / 100;
  const actor = await actorOf(c.user);
  const closing = await prisma.cashClosing.create({
    data: {
      branchId: c.branchId, day,
      openingFloat: calc.openingFloat, cashRepairs: calc.cashRepairs, cashSales: calc.cashSales, cashIn: calc.cashIn, cashOut: calc.cashOut,
      expected: calc.expected, counted, difference: Math.round((counted - calc.expected) * 100) / 100,
      denominations, leftInCash, withdrawn: Math.round((counted - leftInCash) * 100) / 100,
      qrTotal: calc.qrTotal, qrVerified: b.qrVerified === true,
      notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 300) : null,
      userId: actor.userId, userName: actor.userName,
    },
  });

  // Aviso al dueño: WhatsApp (si está configurado) y Telegram de los Super Admin; campana si no cuadra
  (async () => {
    const [s, cfg, branch] = await Promise.all([getSettings(), getAutomationConfig(), prisma.branch.findUnique({ where: { id: c.branchId }, select: { name: true } })]);
    const text = closingText(closing, branch?.name || "", s?.companyName || "RepairTrackQR", calc.label);
    const wa = cfg.ownerPhone ? await sendWhatsAppSafe(cfg.ownerPhone, text) : false;
    const { telegramToOwners } = await import("@/backend/telegram");
    await telegramToOwners(closing.difference < 0 ? "🔴 Cierre de caja con faltante" : "🔒 Cierre de caja", text.replace(/\*/g, ""), "/cash");
    if (closing.difference !== 0) {
      const supers = await prisma.user.findMany({ where: { status: "active", OR: [{ role: "superadmin" }, { role: "admin", branchId: c.branchId }] }, select: { id: true } });
      const msg = `${branch?.name || ""} · ${calc.label}: ${closing.difference < 0 ? "faltan" : "sobran"} Bs. ${Math.abs(closing.difference)} (cerró ${actor.userName})`;
      await prisma.notification.createMany({ data: supers.filter((u) => u.id !== c.user.id).map((u) => ({ type: "cash", title: closing.difference < 0 ? "🔴 Faltante en caja" : "🟡 Sobrante en caja", message: msg, userId: u.id, branchId: c.branchId })) });
    }
    void wa;
  })().catch((e) => console.error("[Cierre]", e));

  return NextResponse.json(closing, { status: 201 });
}

/** Reabrir (solo Super Admin): borra el cierre de ese día para hacerlo de nuevo. ?id= */
export async function DELETE(request: Request) {
  const c = await ctx(request);
  if ("error" in c) return c.error;
  if (c.user.role !== "superadmin") return forbidden("Solo el Super Admin puede reabrir una caja");
  const id = new URL(request.url).searchParams.get("id") || "";
  const row = await prisma.cashClosing.findUnique({ where: { id } });
  if (!row || !canAccessBranch(c.user, row.branchId)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const later = await prisma.cashClosing.findFirst({ where: { branchId: row.branchId, day: { gt: row.day } }, select: { day: true } });
  if (later) return NextResponse.json({ error: `Primero reabre el cierre del ${later.day}` }, { status: 400 });
  await prisma.cashClosing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

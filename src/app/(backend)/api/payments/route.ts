import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, canAccessBranch, unauthorized, forbidden, notFound } from "@/backend/auth";
import { getPaymentQr, isPayMethod, savePaymentQr } from "@/backend/payments";

/**
 * QR de cobro del taller.
 *  GET            personal: datos completos · sin sesión: solo si se muestra en documentos
 *  PUT            (Super Admin) { image, bank, holder, onDocuments }
 *  POST           { kind: "repair" | "sale", id, method: "cash" | "qr" | null } → cambia cómo se cobró
 */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  const qr = await getPaymentQr();
  if (!user && !qr.onDocuments) return NextResponse.json({ image: "", bank: "", holder: "", onDocuments: false });
  return NextResponse.json(qr);
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  try {
    return NextResponse.json(await savePaymentQr((await request.json()) || {}));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Datos inválidos" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const { kind, id, method } = await request.json().catch(() => ({}));
  const paidWith = isPayMethod(method) ? method : null;
  if (kind === "repair") {
    const r = await prisma.repair.findUnique({ where: { id: String(id || "") }, select: { branchId: true, technicianId: true } });
    if (!r) return notFound("Orden no encontrada");
    if (!canAccessBranch(user, r.branchId) || (user.role === "tech" && r.technicianId !== user.id)) return forbidden();
    await prisma.repair.update({ where: { id }, data: { paidWith } });
    return NextResponse.json({ ok: true, paidWith });
  }
  if (kind === "sale") {
    if (user.role === "tech") return forbidden("Solo administradores");
    const q = await prisma.quotation.findUnique({ where: { id: String(id || "") }, select: { branchId: true, type: true } });
    if (!q) return notFound("Nota de venta no encontrada");
    if (!canAccessBranch(user, q.branchId)) return forbidden();
    await prisma.quotation.update({ where: { id }, data: { paidWith } });
    return NextResponse.json({ ok: true, paidWith });
  }
  return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
}

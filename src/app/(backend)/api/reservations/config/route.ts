import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden, getEffectiveBranchId, canAccessBranch, isAdmin } from "@/backend/auth";
import { branchResvCfg, saveBranchResvCfg, HOURS_OPTIONS, MAX_ACTIVE_PER_PHONE, MAX_QTY } from "@/backend/reservations";

/** Apartados de la sucursal activa: encendido y horas (administradores). */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  return NextResponse.json({ branchId, hoursOptions: HOURS_OPTIONS, maxPerPhone: MAX_ACTIVE_PER_PHONE, maxQty: MAX_QTY, ...(await branchResvCfg(branchId)) });
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId || !canAccessBranch(user, branchId)) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  const cfg = await saveBranchResvCfg(branchId, await request.json().catch(() => ({})));
  return NextResponse.json({ branchId, hoursOptions: HOURS_OPTIONS, maxPerPhone: MAX_ACTIVE_PER_PHONE, maxQty: MAX_QTY, ...cfg });
}

import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden, getEffectiveBranchId, canAccessBranch, isAdmin } from "@/backend/auth";
import { DAY_NAMES, saveBranchSchedule, scheduleFor } from "@/backend/appointments";

/** Horario de citas de la sucursal activa (administradores). */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  return NextResponse.json({ branchId, dayNames: DAY_NAMES, ...(await scheduleFor(branchId)) });
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const branchId = getEffectiveBranchId(request, user);
  if (!branchId || !canAccessBranch(user, branchId)) return NextResponse.json({ error: "Elige una sucursal" }, { status: 400 });
  try {
    return NextResponse.json({ branchId, dayNames: DAY_NAMES, ...(await saveBranchSchedule(branchId, await request.json().catch(() => ({})))) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

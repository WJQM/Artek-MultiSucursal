import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden, isAdmin, getEffectiveBranchId } from "@/backend/auth";
import { technicianPerformance } from "@/backend/performance";
import { startOfDay, addDays, startOfMonth } from "@/shared/dates";

/** ?period=month|30|90|365 (por defecto este mes). Sucursal activa; el Super Admin sin sucursal ve todas. */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  const period = new URL(request.url).searchParams.get("period") || "month";
  const to = addDays(startOfDay(), 1);
  const from = period === "month" ? startOfMonth() : addDays(to, -Math.min(730, Math.max(1, parseInt(period) || 30)));
  const data = await technicianPerformance(getEffectiveBranchId(request, user), from, to);
  return NextResponse.json({ ...data, from, to, period });
}

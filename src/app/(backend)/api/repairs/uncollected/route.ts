import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, canAccessBranch, isAdmin, unauthorized, forbidden } from "@/backend/auth";
import { listUncollected, sendReminder } from "@/backend/uncollected";
import { publicBaseUrl } from "@/backend/public-url";
import { rateLimit } from "@/backend/rate-limit";

// Equipos listos que el cliente no recogió (panel) y recordatorio por WhatsApp
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();
  return NextResponse.json(await listUncollected(getEffectiveBranchId(request, user)));
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 50) : [];
  if (!ids.length) return NextResponse.json({ error: "Nada que recordar" }, { status: 400 });
  const rl = rateLimit(`remind:${user.id}`, 100, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados recordatorios, intenta más tarde" }, { status: 429 });
  const repairs = await prisma.repair.findMany({ where: { id: { in: ids } }, select: { id: true, branchId: true } });
  const origin = publicBaseUrl(request);
  const results = [];
  for (const r of repairs) {
    if (!canAccessBranch(user, r.branchId)) continue;
    const res = await sendReminder(r.id, origin);
    results.push({ id: r.id, ...res });
  }
  return NextResponse.json({ results });
}

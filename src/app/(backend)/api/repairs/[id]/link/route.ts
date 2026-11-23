import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, canAccessBranch, forbidden, notFound, unauthorized } from "@/backend/auth";
import { publicBaseUrl } from "@/backend/public-url";
import { publicOrigin } from "@/backend/company";
import { clientTrackUrl } from "@/backend/track-access";

// GET /api/repairs/[id]/link — enlace personal del cliente para mandarlo por WhatsApp
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const repair = await prisma.repair.findUnique({ where: { id }, select: { id: true, code: true, branchId: true } });
  if (!repair) return notFound("Orden no encontrada");
  if (!canAccessBranch(user, repair.branchId)) return forbidden();
  const origin = await publicOrigin(publicBaseUrl(request));
  return NextResponse.json({ url: clientTrackUrl(origin, repair) });
}

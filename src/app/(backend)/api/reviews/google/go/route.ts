import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { googleLinkFor, recordClick } from "@/backend/google-reviews";

/** Enlace público "Dejar reseña en Google": cuenta el clic y lleva al enlace de Google de la sucursal. ?r=<id de la orden> o ?b=<sucursal> */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const r = url.searchParams.get("r");
  const b = url.searchParams.get("b");
  let branchId: string | null = null;
  if (r) branchId = (await prisma.repair.findUnique({ where: { id: r }, select: { branchId: true } }).catch(() => null))?.branchId || null;
  else if (b) branchId = b;
  const link = await googleLinkFor(branchId);
  if (!link || !branchId) return NextResponse.redirect(new URL("/portal", url.origin));
  if (rateLimit(`gclick:${getClientIp(request)}`, 20, 60 * 60_000).ok) await recordClick(branchId).catch(() => {});
  return NextResponse.redirect(link);
}

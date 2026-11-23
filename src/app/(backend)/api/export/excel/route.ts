import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden, isAdmin, getEffectiveBranchId } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { zonedMidnight, addDays } from "@/shared/dates";
import { buildWorkbook, EXPORT_SHEETS, type SheetKey } from "@/backend/excel-export";

export const runtime = "nodejs";

/** ?from=AAAA-MM-DD&to=AAAA-MM-DD (incluido)&sheets=resumen,ordenes,… → archivo .xlsx */
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden("Solo administradores");
  if (!rateLimit(`xlsx:${user.id}`, 30, 60 * 60_000).ok) return NextResponse.json({ error: "Demasiadas descargas seguidas, espera un momento" }, { status: 429 });
  const url = new URL(request.url);
  const parse = (s: string | null) => { const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? zonedMidnight(+m[1], +m[2], +m[3]) : null; };
  const from = parse(url.searchParams.get("from")), toIncl = parse(url.searchParams.get("to"));
  if (!from || !toIncl || toIncl < from) return NextResponse.json({ error: "Elige un período válido" }, { status: 400 });
  if ((toIncl.getTime() - from.getTime()) / 86_400_000 > 3 * 366) return NextResponse.json({ error: "El período máximo es de 3 años" }, { status: 400 });
  const to = addDays(toIncl, 1);
  const sheets = (url.searchParams.get("sheets") || EXPORT_SHEETS.join(",")).split(",").filter((s): s is SheetKey => (EXPORT_SHEETS as readonly string[]).includes(s));
  if (!sheets.length) return NextResponse.json({ error: "Elige al menos una hoja" }, { status: 400 });
  const branchId = getEffectiveBranchId(request, user);
  const fmt = (s: string) => s.split("-").reverse().join("/");
  const label = `${fmt(url.searchParams.get("from")!)} al ${fmt(url.searchParams.get("to")!)}`;
  const wb = await buildWorkbook({ branchId, from, to, sheets, label });
  const buf = await wb.xlsx.writeBuffer();
  const branch = branchId ? (await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name || "" : "Todas";
  const name = `RepairTrack_${branch.replace(/[^A-Za-z0-9]+/g, "-")}_${url.searchParams.get("from")}_a_${url.searchParams.get("to")}.xlsx`;
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { prisma } from "@/backend/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";

// GET /api/repairs/clients?q=texto — clientes del Extracto (nombre + celular) con cuántos equipos
// tienen y cuántos siguen en el taller. Se calcula en la base de datos y devuelve como máximo 50.
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role === "tech") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const branchId = getEffectiveBranchId(request, user);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const rows = await prisma.$queryRaw<{ name: string; phone: string; rawName: string | null; rawPhone: string | null; count: bigint; active: bigint }[]>`
    SELECT MAX(COALESCE(NULLIF(TRIM("clientName"), ''), 'Sin nombre')) AS name,
           COALESCE(TRIM("clientPhone"), '') AS phone,
           MAX("clientName") AS "rawName", MAX("clientPhone") AS "rawPhone",
           COUNT(*) AS count,
           COUNT(*) FILTER (WHERE status <> 'delivered') AS active
    FROM "Repair"
    WHERE ${branchId ? Prisma.sql`"branchId" = ${branchId}` : Prisma.sql`TRUE`}
    GROUP BY LOWER(COALESCE(NULLIF(TRIM("clientName"), ''), 'Sin nombre')), COALESCE(TRIM("clientPhone"), '')
    HAVING ${q ? Prisma.sql`(LOWER(MAX(COALESCE("clientName", ''))) LIKE ${like} OR COALESCE(TRIM("clientPhone"), '') LIKE ${like})` : Prisma.sql`TRUE`}
    ORDER BY count DESC, name ASC
    LIMIT 50`;

  return NextResponse.json(rows.map((r) => ({ name: r.name, phone: r.phone, rawName: r.rawName ?? "", rawPhone: r.rawPhone ?? "", count: Number(r.count), active: Number(r.active) })));
}

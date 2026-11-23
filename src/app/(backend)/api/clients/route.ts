import { prisma } from "@/backend/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId } from "@/backend/auth";

// GET /api/clients — clientes únicos (por celular) a partir de órdenes y cotizaciones/ventas.
// Todo se calcula en la base de datos (antes se cargaban todas las órdenes en memoria).
//   ?q=texto       buscar por nombre, celular o correo
//   ?page=N&limit= paginado (Clientes); sin page devuelve los primeros `limit` (autocompletar)
//   ?phone=xxx     un cliente con su historial (últimas 10 órdenes y 10 cotizaciones/ventas)
const KEY = (col: string) => Prisma.raw(`RIGHT(REGEXP_REPLACE(${col}, '\\D', '', 'g'), 8)`);

interface Row {
  phoneKey: string; phone: string; name: string; email: string | null;
  totalRepairs: number; totalSpent: number; totalQuotations: number; totalSales: number;
  lastActivity: Date; firstActivity: Date; full: bigint;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.role === "tech") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const branchId = getEffectiveBranchId(request, user);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const phoneKey = (url.searchParams.get("phone") || "").replace(/\D/g, "").slice(-8);
    const paged = url.searchParams.has("page");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || (paged ? "15" : "50")) || 15));

    const branch = branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty;
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const filters: Prisma.Sql[] = [];
    if (phoneKey) filters.push(Prisma.sql`"phoneKey" = ${phoneKey}`);
    if (q) filters.push(Prisma.sql`(LOWER(name) LIKE ${like} OR phone LIKE ${like} OR LOWER(COALESCE(email, '')) LIKE ${like})`);
    const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;

    const rows = await prisma.$queryRaw<Row[]>`
      WITH acts AS (
        SELECT ${KEY('"clientPhone"')} AS k, "clientName" AS cname, "clientPhone" AS phone, "clientEmail" AS email, "createdAt" AS at,
               1 AS rep, CASE WHEN status = 'delivered' THEN COALESCE("estimatedCost", 0) ELSE 0 END AS spent, 0 AS quo, 0 AS sale
        FROM "Repair" WHERE "clientPhone" IS NOT NULL ${branch}
        UNION ALL
        SELECT ${KEY('"clientPhone"')}, "clientName", "clientPhone", NULL, "createdAt",
               0, CASE WHEN type = 'sale' THEN COALESCE(total, 0) ELSE 0 END, CASE WHEN type = 'sale' THEN 0 ELSE 1 END, CASE WHEN type = 'sale' THEN 1 ELSE 0 END
        FROM "Quotation" WHERE "clientPhone" IS NOT NULL ${branch}
      ),
      agg AS (
        SELECT k AS "phoneKey",
          -- Nombre y celular de la orden más reciente; si solo tiene cotizaciones, de la más reciente
          (ARRAY_AGG(phone ORDER BY rep DESC, at DESC))[1] AS phone,
          COALESCE((ARRAY_AGG(cname ORDER BY rep DESC, at DESC) FILTER (WHERE NULLIF(TRIM(cname), '') IS NOT NULL))[1], 'Sin nombre') AS name,
          (ARRAY_AGG(email ORDER BY at DESC) FILTER (WHERE NULLIF(TRIM(email), '') IS NOT NULL))[1] AS email,
          SUM(rep)::int AS "totalRepairs", SUM(spent)::float AS "totalSpent", SUM(quo)::int AS "totalQuotations", SUM(sale)::int AS "totalSales",
          MAX(at) AS "lastActivity", MIN(at) AS "firstActivity"
        FROM acts WHERE k <> '' GROUP BY k
      )
      SELECT *, COUNT(*) OVER () AS full FROM agg ${where}
      ORDER BY "totalSpent" DESC, "totalRepairs" DESC, "phoneKey"
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const total = rows.length ? Number(rows[0].full) : 0;
    const clients = rows.map(({ full: _f, ...c }) => { void _f; return { ...c, repairs: [] as unknown[], quotations: [] as unknown[] }; });

    // Historial de un cliente (solo cuando se pide por celular)
    if (phoneKey && clients.length) {
      const [repairs, quotations] = await Promise.all([
        prisma.$queryRaw<{ code: string; device: string; status: string; createdAt: Date; cost: number }[]>`
          SELECT code, device, status, "createdAt", COALESCE("estimatedCost", 0)::float AS cost FROM "Repair"
          WHERE "clientPhone" IS NOT NULL AND ${KEY('"clientPhone"')} = ${phoneKey} ${branch}
          ORDER BY "createdAt" DESC LIMIT 10`,
        prisma.$queryRaw<{ code: string; type: string; total: number; createdAt: Date }[]>`
          SELECT code, type, COALESCE(total, 0)::float AS total, "createdAt" FROM "Quotation"
          WHERE "clientPhone" IS NOT NULL AND ${KEY('"clientPhone"')} = ${phoneKey} ${branch}
          ORDER BY "createdAt" DESC LIMIT 10`,
      ]);
      clients[0].repairs = repairs;
      clients[0].quotations = quotations;
    }

    return NextResponse.json({ clients, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error("[Clients] Error:", error);
    return NextResponse.json({ error: "Error al cargar clientes" }, { status: 500 });
  }
}

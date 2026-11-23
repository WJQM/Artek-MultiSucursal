import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ results: [] });

    // Determinar sucursal (si no es superadmin, solo su sucursal)
    const url_branchId = url.searchParams.get("branchId");
    // Sin sucursal asignada no se busca en ninguna ("" no coincide con nada)
    const branchFilter: { branchId?: string } = user.role === "superadmin"
      ? (url_branchId ? { branchId: url_branchId } : {})
      : { branchId: user.branchId ?? "" };

    const upperQ = q.toUpperCase();

    // Búsquedas en paralelo
    // El técnico busca órdenes (puede cubrir las de un compañero), equipos y consolas; no documentos de venta
    const isTech = user.role === "tech";
    const none = Promise.resolve([] as never[]);
    const [repairs, equipment, consoles, quotations, certificates] = await Promise.all([
      // OTs: por código, cliente, teléfono, device
      prisma.repair.findMany({
        where: {
          ...branchFilter,
          OR: [
            { code: { contains: upperQ } },
            { clientName: { contains: q, mode: "insensitive" } },
            { clientPhone: { contains: q } },
            { device: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, clientName: true, device: true, brand: true, model: true, status: true, createdAt: true, technicianId: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Equipos: por código, nombre, marca, modelo
      prisma.equipment.findMany({
        where: {
          ...branchFilter,
          OR: [
            { code: { contains: upperQ } },
            { id: { contains: upperQ } },
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { processor: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, name: true, brand: true, model: true, condition: true, price: true },
        take: 5,
      }),
      // Consolas: por código, nombre, marca
      prisma.console.findMany({
        where: {
          ...branchFilter,
          OR: [
            { code: { contains: upperQ } },
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, name: true, brand: true, model: true, condition: true, price: true },
        take: 5,
      }),
      // Cotizaciones/Notas de venta: por código, clientName
      isTech ? none : prisma.quotation.findMany({
        where: {
          ...branchFilter,
          OR: [
            { code: { contains: upperQ } },
            { clientName: { contains: q, mode: "insensitive" } },
            { clientPhone: { contains: q } },
          ],
        },
        select: { id: true, code: true, clientName: true, type: true, total: true, createdAt: true, branchId: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Certificados
      isTech ? none : prisma.certificate.findMany({
        where: {
          ...branchFilter,
          OR: [
            { code: { contains: upperQ } },
            { clientName: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, clientName: true, createdAt: true, branchId: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Formatear resultados con type uniforme
    const results = [
      ...repairs.map((r) => ({
        type: "repair",
        id: r.id,
        code: r.code,
        title: `${r.device}${r.brand ? " " + r.brand : ""}${r.model ? " " + r.model : ""}`,
        subtitle: r.clientName || "Sin cliente",
        meta: r.status,
        // Técnico: sus órdenes en Mis Asignaciones; las de un compañero, en su seguimiento
        url: isTech ? (r.technicianId === user.id ? `/asignaciones?focus=${r.code}` : `/track/${r.code}`) : `/dashboard?focus=${r.code}`,
      })),
      ...equipment.map((e) => ({
        type: "equipment",
        id: e.id,
        code: e.code || `EQ-${e.id.slice(-6).toUpperCase()}`,
        title: `${e.name}${e.brand ? " — " + e.brand : ""}${e.model ? " " + e.model : ""}`,
        subtitle: `Bs. ${e.price || 0}`,
        meta: e.condition,
        url: `/equipment/print/${e.id}`,
      })),
      ...consoles.map((c) => ({
        type: "console",
        id: c.id,
        code: c.code || `CN-?`,
        title: `${c.name}${c.brand ? " — " + c.brand : ""}${c.model ? " " + c.model : ""}`,
        subtitle: `Bs. ${c.price || 0}`,
        meta: c.condition,
        url: `/consoles/print/${c.id}`,
      })),
      ...quotations.map((q) => ({
        type: q.type === "sale" ? "sale" : "quotation",
        id: q.id,
        code: q.code,
        title: q.clientName || "Sin cliente",
        subtitle: `Bs. ${q.total || 0}`,
        meta: null,
        url: `/quotations/print/${q.code}?branchId=${q.branchId}`, // antes usaba el id y la página no lo encontraba
      })),
      ...certificates.map((c) => ({
        type: "certificate",
        id: c.id,
        code: c.code,
        title: c.clientName || "Sin cliente",
        subtitle: null,
        meta: null,
        url: `/certificate-view/${c.code}?branchId=${c.branchId}`,
      })),
    ];

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("[Search] Error:", error);
    return NextResponse.json({ error: "Error en búsqueda", details: errMsg(error) }, { status: 500 });
  }
}

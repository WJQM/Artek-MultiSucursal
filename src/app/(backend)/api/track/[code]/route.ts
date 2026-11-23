import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken, canAccessBranch, maskName, maskTail } from "@/backend/auth";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { trackTokenRepairId, readTrackToken } from "@/backend/track-access";
import { clientReport, clientReportCount } from "@/backend/repair-log";

/**
 * Consulta de OT por código (portal público, QR, impresión).
 * - Personal con sesión y acceso a la sucursal → registro completo
 *   (salvo ?public=1: el portal siempre se ve como lo ve el cliente).
 * - Cliente verificado (últimos 4 dígitos del celular → pase x-track-token) → sus datos completos.
 * - Público → modo protegido: estado, avance, equipo y fechas. Sin problema, notas, costos, fotos
 *   ni accesorios; nombre y celular enmascarados. Así no se puede recorrer OT-1, OT-2… para leer datos de clientes.
 */
type TrackRepair = Prisma.RepairGetPayload<{ include: { branch: { select: { id: true; name: true; address: true; phone: true; latitude: true; longitude: true; hours: true } }; technician: { select: { name: true } } } }>;

function clientView(r: TrackRepair) {
  return {
    id: r.id,
    code: r.code,
    qrCode: r.qrCode,
    device: r.device,
    brand: r.brand,
    model: r.model,
    imei: r.imei,
    issue: r.issue,
    status: r.status,
    priority: r.priority,
    estimatedCost: r.estimatedCost,
    accessories: r.accessories,
    notes: r.notes,
    image: r.image,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    branchId: r.branchId,
    branch: r.branch,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deliveredAt: r.deliveredAt,
    verified: true,
  };
}

function protectedView(r: TrackRepair) {
  return {
    id: r.id,
    code: r.code,
    device: r.device,
    brand: r.brand,
    model: r.model,
    status: r.status,
    priority: r.priority,
    clientName: maskName(r.clientName),
    clientPhone: maskTail(r.clientPhone, 3),
    branchId: r.branchId,
    branch: r.branch,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deliveredAt: r.deliveredAt,
    protected: true,
    canVerify: String(r.clientPhone || "").replace(/\D/g, "").length >= 4,
    // Campos ocultos (la página muestra "🔒" en su lugar)
    issue: null, notes: null, accessories: null, image: null, estimatedCost: null,
  };
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await getUserFromToken(request, { allowCookie: true });

    if (!user || new URL(request.url).searchParams.get("public") === "1") {
      const rl = rateLimit(`track:${getClientIp(request)}`, 60, 10 * 60_000);
      if (!rl.ok) return NextResponse.json({ error: "Demasiadas consultas, espera unos minutos" }, { status: 429 });
    }

    const { code: rawCode } = await context.params;
    const code = decodeURIComponent(String(rawCode || "")).trim().toUpperCase().substring(0, 40);
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    const forcePublic = searchParams.get("public") === "1";
    const passFor = trackTokenRepairId(readTrackToken(request));
    // Personal de la sucursal: datos completos. Al técnico se le indica si puede tomar la orden.
    const staffView = (r: TrackRepair) => {
      const { technician, ...rest } = r;
      if (user?.role !== "tech") return rest;
      return { ...rest, technicianName: technician?.name || null, canTake: r.technicianId !== user.id && r.status !== "delivered" };
    };
    const view = (r: TrackRepair) =>
      !forcePublic && user && canAccessBranch(user, r.branchId) ? staffView(r)
      : passFor === r.id ? clientView(r)
      : protectedView(r);
    // Informe técnico: lo publicado para el cliente (con el nombre del técnico). En modo protegido
    // solo se dice cuántas novedades hay, para invitar a verificar el celular.
    const finish = async (v: { id: string; protected?: boolean }) => {
      if (v.protected) return { ...v, reportCount: await clientReportCount(v.id) };
      return { ...v, report: await clientReport(v.id) };
    };

    if (branchId) {
      const repair = await prisma.repair.findFirst({
        where: { branchId, OR: [{ code }, { qrCode: code }] },
        include: { branch: { select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true, hours: true } }, technician: { select: { name: true } } },
      });
      if (!repair) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
      return NextResponse.json(await finish(view(repair)));
    }

    const repairs = await prisma.repair.findMany({
      where: { OR: [{ code }, { qrCode: code }] },
      include: { branch: { select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true, hours: true } }, technician: { select: { name: true } } },
    });

    if (repairs.length === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (repairs.length === 1) return NextResponse.json(await finish(view(repairs[0])));
    return NextResponse.json({ multiple: true, repairs: repairs.map(view) });
  } catch (error) {
    console.error("Track error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

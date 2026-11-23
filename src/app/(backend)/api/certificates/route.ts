import type { Prisma } from "@prisma/client";
import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { withUniqueRetry } from "@/backend/unique-retry";
import { getUserFromToken, getEffectiveBranchId, canAccessBranch, requireAdmin, maskName, maskTail, forbidden, notFound } from "@/backend/auth";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { todayISO } from "@/shared/dates";

// Vista pública: las claves de producto se ocultan (solo últimos 5 caracteres) y el nombre se abrevia
type CertWithBranch = Prisma.CertificateGetPayload<{ include: { user: { select: { id: true; name: true } }; branch: { select: { id: true; name: true } } } }>;
function publicCert(c: CertWithBranch) {
  return {
    id: c.id,
    code: c.code,
    clientName: maskName(c.clientName),
    computerName: c.computerName,
    windowsEdition: c.windowsEdition,
    windowsSerial: maskTail(c.windowsSerial, 5),
    officeEdition: c.officeEdition,
    officeSerial: maskTail(c.officeSerial, 5),
    date: c.date,
    technician: c.technician,
    notes: c.notes,
    branchId: c.branchId,
    branch: c.branch,
    createdAt: c.createdAt,
  };
}

// GET - List certificates for the current branch, or search by code across branches
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const qBranchId = searchParams.get("branchId");

  // Search by code (used by scanner/search and public certificate view)
  if (code) {
    const viewer = await getUserFromToken(request, { allowCookie: true });
    if (!viewer) {
      const rl = rateLimit(`cert:${getClientIp(request)}`, 60, 10 * 60_000);
      if (!rl.ok) return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
    }
    // El técnico no maneja certificados: al escanear uno ve la versión pública
    const view = (c: CertWithBranch) => (viewer && viewer.role !== "tech" && canAccessBranch(viewer, c.branchId) ? c : publicCert(c));
    const cleanCode = code.trim().toUpperCase().substring(0, 40);

    if (qBranchId) {
      const cert = await prisma.certificate.findFirst({
        where: { code: cleanCode, branchId: qBranchId },
        include: { user: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
      });
      if (!cert) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json(view(cert));
    }
    // Search across all branches
    const certs = await prisma.certificate.findMany({
      where: { code: cleanCode },
      include: { user: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
    if (certs.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (certs.length === 1) return NextResponse.json(view(certs[0]));
    // Multiple matches across branches
    return NextResponse.json({ multiple: true, certificates: certs.map(view) });
  }

  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role === "tech") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const branchId = getEffectiveBranchId(request, user);
  const where: Prisma.CertificateWhereInput = {};
  if (branchId) where.branchId = branchId;

  try {
    const certificates = await prisma.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(certificates);
  } catch (error) {
    console.error("Certificates GET error:", error);
    return NextResponse.json({ error: "Error al obtener certificados" }, { status: 500 });
  }
}

// POST - Create a new certificate
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const branchId = getEffectiveBranchId(request, user);
  if (!branchId) return NextResponse.json({ error: "Se requiere sucursal" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      clientName,
      computerName,
      windowsEdition,
      windowsSerial,
      officeEdition,
      officeSerial,
      date,
      technician,
      notes,
    } = body;

    if (!clientName) return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    if (!windowsSerial && !officeSerial) return NextResponse.json({ error: "Se requiere al menos una clave de producto" }, { status: 400 });

    // Reintenta con el siguiente número si otra persona tomó el mismo código a la vez
    const certificate = await withUniqueRetry(async () => {
      // Generate auto-incremental code per branch: CL-1, CL-2, etc.
      const result = await prisma.$queryRaw<{max_num: number}[]>`
        SELECT COALESCE(MAX(CAST(REPLACE(code, 'CL-', '') AS INTEGER)), 0) as max_num
        FROM "Certificate"
        WHERE "branchId" = ${branchId} AND code ~ '^CL-[0-9]+$'
      `;
      const code = `CL-${(result[0]?.max_num || 0) + 1}`;

      return await prisma.certificate.create({
        data: {
          code,
          clientName,
          computerName: computerName || null,
          windowsEdition: windowsSerial ? (windowsEdition || null) : null,
          windowsSerial: windowsSerial || null,
          officeEdition: officeSerial ? (officeEdition || null) : null,
          officeSerial: officeSerial || null,
          date: date || todayISO(),
          technician: technician || "",
          notes: notes || null,
          branchId,
          userId: user.id,
        },
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(certificate, { status: 201 });
  } catch (error) {
    console.error("Certificates POST error:", error);
    return NextResponse.json({ error: "Error al crear certificado" }, { status: 500 });
  }
}

// PATCH - Update a certificate
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, ...updateFields } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const existing = await prisma.certificate.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return notFound();
    if (!canAccessBranch(user, existing.branchId)) return forbidden();

    const updateData: Prisma.CertificateUpdateInput = {};
    if (updateFields.clientName !== undefined) updateData.clientName = updateFields.clientName;
    if (updateFields.computerName !== undefined) updateData.computerName = updateFields.computerName || null;
    if (updateFields.windowsEdition !== undefined) updateData.windowsEdition = updateFields.windowsEdition || null;
    if (updateFields.windowsSerial !== undefined) updateData.windowsSerial = updateFields.windowsSerial || null;
    if (updateFields.officeEdition !== undefined) updateData.officeEdition = updateFields.officeEdition || null;
    if (updateFields.officeSerial !== undefined) updateData.officeSerial = updateFields.officeSerial || null;
    if (updateFields.date !== undefined) updateData.date = updateFields.date;
    if (updateFields.technician !== undefined) updateData.technician = updateFields.technician;
    if (updateFields.notes !== undefined) updateData.notes = updateFields.notes || null;

    const certificate = await prisma.certificate.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(certificate);
  } catch (error) {
    console.error("Certificates PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE - Delete a certificate
export async function DELETE(request: Request) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const existing = await prisma.certificate.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return notFound();
    if (!canAccessBranch(user, existing.branchId)) return forbidden();

    await prisma.certificate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Certificates DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

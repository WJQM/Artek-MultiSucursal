import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";
import { resolveLocation } from "@/shared/geo";
import { sanitizeHours } from "@/shared/hours";

const HOURS_ERROR = "Revisa el horario: usa horas como 08:30 y la hora de cierre debe ser después de la de apertura.";

/**
 * "location" del formulario: coordenadas o enlace de Google Maps.
 * undefined = no se toca; "" / null = se borra; texto que no se entiende = error.
 */
async function locationData(location: unknown): Promise<{ latitude: number | null; longitude: number | null } | undefined | "invalid"> {
  if (location === undefined) return undefined;
  const raw = typeof location === "string" ? location.trim().slice(0, 2000) : "";
  if (!raw) return { latitude: null, longitude: null };
  const p = await resolveLocation(raw);
  return p ? { latitude: p.lat, longitude: p.lng } : "invalid";
}
const LOCATION_ERROR = "No pude leer la ubicación. Pega el enlace de Google Maps (Compartir → Copiar vínculo) o las coordenadas, por ejemplo -17.3935, -66.1570";

export async function GET(request: Request) {
  const user = await getUserFromToken(request);

  try {
    // Acceso público (registro y portal): nombre, dirección y teléfono de contacto
    if (!user) {
      const branches = await prisma.branch.findMany({
        where: { active: true },
        select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true, hours: true },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(branches);
    }

    // Authenticated: return full details
    const branches = await prisma.branch.findMany({
      where: { active: true },
      include: { _count: { select: { users: true, repairs: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(branches);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { name, address, phone, location, hours } = await request.json();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    const h = sanitizeHours(hours);
    if (h === "invalid") return NextResponse.json({ error: HOURS_ERROR }, { status: 400 });
    const loc = await locationData(location);
    if (loc === "invalid") return NextResponse.json({ error: LOCATION_ERROR }, { status: 400 });

    const branch = await prisma.branch.create({
      data: { name, address: address || null, phone: phone || null, hours: h ? JSON.stringify(h) : null, ...(loc || {}) },
    });
    return NextResponse.json(branch, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear sucursal" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { id, name, address, phone, active, location, hours } = await request.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const h = hours === undefined ? undefined : sanitizeHours(hours);
    if (h === "invalid") return NextResponse.json({ error: HOURS_ERROR }, { status: 400 });
    const loc = await locationData(location);
    if (loc === "invalid") return NextResponse.json({ error: LOCATION_ERROR }, { status: 400 });

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(active !== undefined && { active }),
        ...(h !== undefined && { hours: h ? JSON.stringify(h) : null }),
        ...(loc || {}),
      },
    });
    return NextResponse.json(branch);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { id } = await request.json();
    await prisma.branch.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

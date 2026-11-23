import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { getUserFromToken } from "@/backend/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await context.params;

    // Verificar que el usuario tenga acceso a esta OT (misma sucursal)
    const repair = await prisma.repair.findUnique({
      where: { id },
      select: { branchId: true, technicianId: true },
    });
    if (!repair) return NextResponse.json({ error: "OT no encontrada" }, { status: 404 });

    // Permisos: superadmin ve todo, admin su sucursal, tech solo si está asignado
    if (user.role !== "superadmin" && repair.branchId !== user.branchId) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
    if (user.role === "tech" && repair.technicianId !== user.id) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    const history = await prisma.statusHistory.findMany({
      where: { repairId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("[Repair History] Error:", error);
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}

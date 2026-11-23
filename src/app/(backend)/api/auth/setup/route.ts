import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";

// GET /api/auth/setup → ¿ya existe un Super Admin? (/setup solo ofrece "Crear primer Super Admin" si no hay ninguno)
export async function GET() {
  try {
    const count = await prisma.user.count({ where: { role: "superadmin" } });
    return NextResponse.json({ hasSuperadmin: count > 0 });
  } catch {
    return NextResponse.json({ hasSuperadmin: true });
  }
}

import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { getCatalogo, saveCatalogo } from "@/backend/recepcion";

// GET: cualquier usuario con sesión. PUT: solo admin y superadmin.
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  return NextResponse.json(await getCatalogo());
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "admin" && user.role !== "superadmin") return forbidden("Solo administradores");
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.devices) || !Array.isArray(body.accessories)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  return NextResponse.json(await saveCatalogo(body));
}

import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { publicAiConfig, saveAiConfig, testAi } from "@/backend/ai";

// IA del taller (solo Super Admin). La clave nunca vuelve al navegador.
export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  return NextResponse.json(await publicAiConfig());
}

export async function PUT(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  try {
    return NextResponse.json(await saveAiConfig(await request.json().catch(() => ({}))));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Probar la clave */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role !== "superadmin") return forbidden("Solo el Super Admin");
  if (!rateLimit(`ai-test:${user.id}`, 10, 10 * 60_000).ok) return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  const r = await testAi();
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

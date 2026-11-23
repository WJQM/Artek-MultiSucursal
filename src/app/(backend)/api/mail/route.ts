import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { mailLayout, mailStatus, publicMailConfig, saveMailConfig, sendMail } from "@/backend/mail";

// Correo del sistema (solo Super Admin): configuración y correo de prueba
async function guard(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return { res: unauthorized() };
  if (user.role !== "superadmin") return { res: forbidden("Solo el Super Admin") };
  return { user };
}

export async function GET(request: Request) {
  const g = await guard(request); if ("res" in g) return g.res;
  const [config, last] = await Promise.all([publicMailConfig(), mailStatus()]);
  return NextResponse.json({ config, last });
}

export async function PUT(request: Request) {
  const g = await guard(request); if ("res" in g) return g.res;
  try {
    return NextResponse.json({ config: await saveMailConfig((await request.json()) || {}) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Datos inválidos" }, { status: 400 });
  }
}

/** Correo de prueba al correo de la cuenta (o a { to }) */
export async function POST(request: Request) {
  const g = await guard(request); if ("res" in g) return g.res;
  const rl = rateLimit(`mail-test:${g.user.id}`, 6, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Espera unos minutos antes de otra prueba" }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const me = await prisma.user.findUnique({ where: { id: g.user.id }, select: { email: true, name: true } });
  const to = typeof body.to === "string" && body.to.trim() ? body.to.trim() : me?.email || "";
  const html = await mailLayout({ title: "✅ El correo del sistema funciona", intro: `Hola${me?.name ? ` ${me.name}` : ""}, este es un correo de prueba. Desde ahora el sistema puede enviar comprobantes, cotizaciones, códigos de recuperación y alertas.` });
  const r = await sendMail(to, "Correo de prueba del sistema", html);
  return NextResponse.json({ ...r, to });
}

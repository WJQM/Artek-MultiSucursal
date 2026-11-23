import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { verifyTurnstile, CAPTCHA_ERROR } from "@/backend/turnstile";
import { validatePassword } from "@/backend/secure";
import { normalizePhone, sendCode, maskPhone } from "@/backend/otp";
import { signChallenge, companyName } from "@/backend/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registro: crea la cuenta (pendiente de aprobación) y envía un PIN por WhatsApp
 * para verificar el celular. Responde { stage: "verify_phone", challenge, maskedPhone }.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiados registros desde esta conexión. Intenta más tarde." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, password, branchId, image, captchaToken } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role || "tech";

    if (!(await verifyTurnstile(captchaToken, ip))) {
      return NextResponse.json({ error: CAPTCHA_ERROR, captcha: true }, { status: 400 });
    }

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, correo y contraseña son requeridos" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const phone = normalizePhone(body.phone);
    if (!phone) {
      return NextResponse.json({ error: "Ingresa un número de celular válido con WhatsApp (ej: 71234567)" }, { status: 400 });
    }
    if (!["superadmin", "admin", "tech"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // El registro público de Super Admin solo existe en la primera instalación (cuando no hay ninguno).
    // Después, los Super Admin nuevos los crea otro Super Admin desde Administración → Usuarios.
    if (role === "superadmin" && (await prisma.user.count({ where: { role: "superadmin" } })) > 0) {
      return NextResponse.json({ error: "Ya existe un Super Admin. Pide que te creen la cuenta desde Usuarios." }, { status: 403 });
    }

    if (role !== "superadmin") {
      if (!branchId) {
        return NextResponse.json({ error: "Se requiere una sucursal para admin/técnico" }, { status: 400 });
      }
      const branch = await prisma.branch.findFirst({ where: { id: String(branchId), active: true }, select: { id: true } });
      if (!branch) return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existingUser) {
      return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim().substring(0, 100),
        email,
        password: hashedPassword,
        role,
        phone,
        phoneVerified: false,
        // Todas las cuentas nuevas (admin/tech) esperan aprobación del superadmin
        status: role === "superadmin" ? "active" : "pending",
        branchId: role === "superadmin" ? null : String(branchId),
        image: typeof image === "string" && image.startsWith("/uploads/") ? image : null,
        passwordChangedAt: new Date(),
      },
    });

    const sent = await sendCode(user.id, "register", phone, await companyName());

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      stage: "verify_phone",
      challenge: signChallenge({ uid: user.id, stage: "verify_phone", tv: user.tokenVersion }),
      maskedPhone: maskPhone(phone),
      pinSent: sent.ok,
      pinError: sent.ok ? undefined : sent.error,
    });
  } catch (error) {
    console.error("Register error:", errMsg(error) || error);
    return NextResponse.json({ error: "Error al registrar usuario" }, { status: 500 });
  }
}

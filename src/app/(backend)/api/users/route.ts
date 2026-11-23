import { prisma } from "@/backend/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getUserFromToken, invalidateUserCache, ROLES } from "@/backend/auth";
import { validatePassword } from "@/backend/secure";
import { normalizePhone } from "@/backend/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
const cleanImage = (v: unknown) => (typeof v === "string" && v.startsWith("/uploads/") ? v : null);
const isRole = (v: unknown): v is string => typeof v === "string" && (ROLES as readonly string[]).includes(v);
/** Admin y Super Admin reciben su PIN de ingreso por WhatsApp: necesitan celular desde el inicio. */
const needsPhone = (role: string) => role === "admin" || role === "superadmin";

async function emailTaken(email: string, exceptId?: string) {
  const u = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!u;
}

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, phone: true, image: true, branchId: true, createdAt: true, phoneVerified: true, totpEnabled: true, twoFactorEnabled: true, mustChangePassword: true, branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const body = await request.json();
    const name = cleanName(body.name);
    const email = cleanEmail(body.email);
    const role = body.role ?? "admin";
    const { password, branchId } = body;
    if (!name || !email || !password) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    if (!isRole(role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    const phone = normalizePhone(body.phone);
    if (needsPhone(role) && !phone) {
      return NextResponse.json({ error: "Admin y Super Admin necesitan un celular con WhatsApp (reciben ahí su PIN de ingreso)" }, { status: 400 });
    }
    if (role !== "superadmin" && !branchId) {
      return NextResponse.json({ error: "Admin/técnico requiere sucursal" }, { status: 400 });
    }
    if (await emailTaken(email)) return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });

    const newUser = await prisma.user.create({
      data: {
        name, email, role,
        password: await bcrypt.hash(password, 10),
        phone: phone || (typeof body.phone === "string" && body.phone.trim()) || null,
        image: cleanImage(body.image),
        status: "active",
        branchId: role === "superadmin" ? null : String(branchId),
        passwordChangedAt: new Date(),
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, branchId: newUser.branchId, branch: newUser.branch }, { status: 201 });
  } catch (e) {
    console.error("Create user error:", e);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const body = await request.json();
    const { id, password, role, phone, branchId, image, status } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    if (role !== undefined && !isRole(role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    if (status !== undefined && !["active", "pending", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    if (password) {
      const pwErr = validatePassword(password);
      if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    }
    // Evitar que el superadmin se quite a sí mismo el rol o se suspenda (quedaría sin acceso)
    if (id === user.id && ((role !== undefined && role !== "superadmin") || (status !== undefined && status !== "active"))) {
      return NextResponse.json({ error: "No puedes quitarte el rol ni suspender tu propia cuenta" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({ where: { id }, select: { role: true, branchId: true, phone: true, email: true } });
    if (!current) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const nextRole: string = role ?? current.role;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = cleanEmail(body.email);
      if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
      if (await emailTaken(email, id)) return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
      data.email = email;
    }
    if (role !== undefined) data.role = role;
    if (phone !== undefined) {
      data.phone = normalizePhone(phone) || (typeof phone === "string" && phone.trim()) || null;
      // Un número distinto se verifica en su próximo inicio de sesión (el formulario siempre manda el celular)
      if (normalizePhone(data.phone) !== normalizePhone(current.phone)) data.phoneVerified = false;
    }
    const finalPhone = phone !== undefined ? data.phone : current.phone;
    if (needsPhone(nextRole) && !normalizePhone(finalPhone)) {
      return NextResponse.json({ error: "Admin y Super Admin necesitan un celular con WhatsApp" }, { status: 400 });
    }
    if (image !== undefined) data.image = cleanImage(image);
    if (nextRole === "superadmin") data.branchId = null;
    else if (branchId !== undefined) data.branchId = branchId || null;
    if (status !== undefined) data.status = status;
    if (password) { data.password = await bcrypt.hash(password, 10); data.passwordChangedAt = new Date(); }

    // Cambios que deben cerrar las sesiones abiertas de ese usuario al instante
    const revoke = !!password || (status !== undefined && status !== "active") ||
      nextRole !== current.role ||
      (data.branchId !== undefined && data.branchId !== current.branchId) ||
      (data.email !== undefined && data.email !== current.email);
    if (revoke) data.tokenVersion = { increment: 1 };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data, include: { branch: { select: { id: true, name: true } } } });
      if (revoke) await tx.trustedDevice.deleteMany({ where: { userId: id } });
      return u;
    });

    invalidateUserCache(id);
    return NextResponse.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, branchId: updated.branchId, branch: updated.branch });
  } catch (e) {
    console.error("Update user error:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getUserFromToken(request);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { id } = await request.json();
    if (!id || typeof id !== "string") return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    if (id === user.id) return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!targetUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Sus registros pasan al primer administrador activo de la sucursal (o a este Super Admin)
    const branchAdmin = targetUser.branchId
      ? await prisma.user.findFirst({
          where: { branchId: targetUser.branchId, id: { not: id }, role: { in: ["admin", "superadmin"] }, status: "active" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      : null;
    const inheritId = branchAdmin?.id ?? user.id;

    // Todo o nada: si algo falla, el usuario queda como estaba
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.quotation.updateMany({ where: { userId: id }, data: { userId: inheritId } }),
      prisma.repair.updateMany({ where: { technicianId: id }, data: { technicianId: null } }),
      prisma.repair.updateMany({ where: { userId: id }, data: { userId: inheritId } }),
      prisma.certificate.updateMany({ where: { userId: id }, data: { userId: inheritId } }),
      prisma.message.updateMany({ where: { userId: id }, data: { userId: inheritId } }),
      prisma.trustedDevice.deleteMany({ where: { userId: id } }),
      prisma.verificationCode.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
    invalidateUserCache(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}

/**
 * EMERGENCIA: recuperar el acceso a una cuenta (por ejemplo, el Super Admin perdió
 * el celular y los códigos de respaldo). Solo lo puede ejecutar quien tiene acceso al servidor.
 *
 *   cd /var/www/repairtrack
 *   npx tsx scripts/reset-access.ts correo@ejemplo.com
 *   npx tsx scripts/reset-access.ts correo@ejemplo.com --celular 71234567   (perdió el celular: pone el nuevo)
 *
 * Hace: contraseña temporal (se pide cambiarla al entrar), quita la app autenticadora y
 * los códigos de respaldo, olvida los dispositivos de confianza y cierra todas las sesiones.
 * El siguiente inicio de sesión pedirá registrar/verificar el celular por WhatsApp.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const email = process.argv[2];
  const clearPhone = process.argv.includes("--quitar-celular");
  const i = process.argv.indexOf("--celular");
  let newPhone: string | null = null;
  if (i > 0) {
    let d = String(process.argv[i + 1] || "").replace(/\D/g, "");
    if (d.length === 8) d = "591" + d;
    if (!/^\d{10,15}$/.test(d)) { console.error("❌ Celular inválido. Ej: --celular 71234567"); process.exit(1); }
    newPhone = d;
  }
  if (!email) {
    console.log("Uso: npx tsx scripts/reset-access.ts correo@ejemplo.com [--celular 71234567 | --quitar-celular]");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) { console.error("❌ No existe un usuario con ese correo"); process.exit(1); }

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const temp = Array.from({ length: 10 }, () => chars[randomInt(0, chars.length)]).join("") + randomInt(0, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(temp, 10),
      mustChangePassword: true,
      totpEnabled: false, totpSecret: null, backupCodes: null,
      tokenVersion: { increment: 1 },
      status: user.status === "suspended" ? "suspended" : "active",
      ...(newPhone ? { phone: newPhone, phoneVerified: false } : clearPhone ? { phone: null, phoneVerified: false } : {}),
    },
  });
  await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
  await prisma.verificationCode.deleteMany({ where: { userId: user.id } });

  console.log(`✅ Acceso restablecido para ${user.email} (${user.role})`);
  console.log(`   Contraseña temporal: ${temp}`);
  console.log(`   Al entrar se pedirá cambiarla${newPhone ? ` y el PIN llegará al ${newPhone}` : clearPhone ? " y registrar un celular nuevo (un Super Admin sin celular no puede entrar: usa --celular)" : ""}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

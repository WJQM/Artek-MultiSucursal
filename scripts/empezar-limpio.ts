/**
 * EMPEZAR LIMPIO: borra los datos de ejemplo/prueba para usar el sistema de verdad.
 *
 *   npx tsx scripts/empezar-limpio.ts                 → solo muestra lo que se borraría (no toca nada)
 *   npx tsx scripts/empezar-limpio.ts --confirmar     → borra
 *
 * Opciones:
 *   --mantener-usuarios   conserva sucursales, administradores y técnicos (solo borra el movimiento)
 *   --borrar-imagenes     también vacía la carpeta de imágenes subidas (UPLOAD_DIR o public/uploads)
 *
 * SIEMPRE se conservan: los Super Admin, la Configuración (nombre, logo, enlace público…)
 * y las categorías del catálogo.
 *
 * Borra: órdenes (OT) y su historial y bitácora técnica, notificaciones, mensajes, reseñas, cotizaciones y notas
 * de venta, certificados, caja chica, visitas del portal, inventario/repuestos (con series),
 * equipos, consolas, programas, videojuegos y servicios. Sin --mantener-usuarios también
 * borra sucursales y todos los usuarios que no son Super Admin.
 *
 * Recomendado: haz antes un respaldo (scripts/backup-diario.sh o Exportar en el sistema).
 */
import "dotenv/config";
import { readdir, unlink } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirmar");
const KEEP_USERS = args.has("--mantener-usuarios");
const WIPE_IMAGES = args.has("--borrar-imagenes");

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const supers = await prisma.user.findMany({ where: { role: "superadmin" }, select: { id: true, email: true } });
    if (supers.length === 0 && !KEEP_USERS) {
      console.error("❌ No hay ningún Super Admin: no se borran usuarios para no dejarte sin acceso.");
      console.error("   Crea el Super Admin en /setup o usa --mantener-usuarios.");
      process.exit(1);
    }
    const notSuper = { role: { not: "superadmin" } };

    const counts: [string, number][] = [
      ["Órdenes (OT)", await prisma.repair.count()],
      ["Historial de estados", await prisma.statusHistory.count()],
      ["Bitácora técnica", await prisma.repairLog.count()],
      ["Notificaciones", await prisma.notification.count()],
      ["Mensajes", await prisma.message.count()],
      ["Reseñas", await prisma.review.count()],
      ["Cotizaciones y notas de venta", await prisma.quotation.count()],
      ["Certificados", await prisma.certificate.count()],
      ["Movimientos de caja", await prisma.cashMovement.count()],
      ["Visitas del portal", await prisma.pageView.count()],
      ["Inventario y repuestos", await prisma.inventoryItem.count()],
      ["Series de productos", await prisma.serialUnit.count()],
      ["Equipos", await prisma.equipment.count()],
      ["Consolas", await prisma.console.count()],
      ["Programas", await prisma.software.count()],
      ["Videojuegos", await prisma.videogame.count()],
      ["Servicios", await prisma.service.count()],
    ];
    if (!KEEP_USERS) {
      counts.push(["Usuarios (admins y técnicos)", await prisma.user.count({ where: notSuper })]);
      counts.push(["Sucursales", await prisma.branch.count()]);
    }

    console.log(CONFIRM ? "\n🧹 Borrando datos…\n" : "\n🔎 Vista previa (no se borra nada). Para borrar agrega --confirmar\n");
    for (const [label, n] of counts) console.log(`   ${String(n).padStart(6)}  ${label}`);
    console.log(`\n   Se conservan: ${supers.length} Super Admin (${supers.map((s) => s.email).join(", ") || "—"}), la Configuración y las categorías.`);
    if (KEEP_USERS) console.log("   También se conservan sucursales y usuarios (--mantener-usuarios).");
    if (WIPE_IMAGES) console.log(`   Se vaciará la carpeta de imágenes: ${uploadDir()}`);

    if (!CONFIRM) return;

    await prisma.$transaction(async (tx) => {
      await tx.statusHistory.deleteMany();
      await tx.repairLog.deleteMany();
      await tx.notification.deleteMany();
      await tx.message.deleteMany();
      await tx.review.deleteMany();
      await tx.pageView.deleteMany();
      await tx.quotation.deleteMany();
      await tx.certificate.deleteMany();
      await tx.cashMovement.deleteMany();
      await tx.serialUnit.deleteMany();
      await tx.inventoryItem.deleteMany();
      await tx.repair.deleteMany();
      await tx.equipment.deleteMany();
      await tx.console.deleteMany();
      await tx.software.deleteMany();
      await tx.videogame.deleteMany();
      await tx.service.deleteMany();
      if (!KEEP_USERS) {
        const gone = (await tx.user.findMany({ where: notSuper, select: { id: true } })).map((u) => u.id);
        await tx.verificationCode.deleteMany({ where: { userId: { in: gone } } });
        await tx.trustedDevice.deleteMany({ where: { userId: { in: gone } } });
        await tx.user.deleteMany({ where: notSuper });
        await tx.branch.deleteMany();
      }
    }, { timeout: 120_000 });

    if (WIPE_IMAGES) {
      const dir = uploadDir();
      const files = await readdir(dir).catch(() => [] as string[]);
      let n = 0;
      for (const f of files) {
        if (f.startsWith(".")) continue;
        await unlink(path.join(dir, f)).then(() => n++).catch(() => {});
      }
      console.log(`   🖼️  ${n} imágenes borradas`);
    }

    console.log("\n✅ Listo. Siguiente paso: entra como Super Admin, revisa Configuración y crea tus sucursales y usuarios.\n");
  } finally {
    await prisma.$disconnect();
  }
}

function uploadDir(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  return env ? path.resolve(env) : path.join(process.cwd(), "public", "uploads");
}

main().catch((e) => { console.error("❌ Error:", e?.message || e); process.exit(1); });

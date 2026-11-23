/**
 * PRUEBA DE CARGA: llena la base con muchos datos falsos para ver hasta dónde aguanta el sistema.
 *
 *   npx tsx scripts/seed-carga.ts                    → nivel "medio" (unas 10.000 órdenes)
 *   npx tsx scripts/seed-carga.ts --nivel=chico      → ~1.000 órdenes      (para probar rápido)
 *   npx tsx scripts/seed-carga.ts --nivel=grande     → ~50.000 órdenes
 *   npx tsx scripts/seed-carga.ts --nivel=enorme     → ~200.000 órdenes    (tarda varios minutos)
 *   npx tsx scripts/seed-carga.ts --ordenes=25000    → número exacto de órdenes
 *   npx tsx scripts/seed-carga.ts --borrar           → quita TODO lo que creó este script
 *
 *   npx tsx scripts/seed-carga.ts --reemplazar --nivel=grande               → vista previa de lo que se borraría
 *   npx tsx scripts/seed-carga.ts --reemplazar --nivel=grande --confirmar   → BORRA tus órdenes, ventas, caja y
 *       catálogo actuales y crea todo en TUS sucursales desde OT-1 (también COT-1, NV-1, CL-1, EQ-1, CN-1).
 *       Conserva usuarios, sucursales y Configuración. Si una sucursal no tiene técnicos, agrega técnicos de prueba.
 *
 * Seguro para WhatsApp/correo:
 *   - Ningún cliente, usuario ni sucursal tiene número de celular ni correo real (van vacíos).
 *     Así ningún aviso, recordatorio ni código puede salir hacia un número.
 *   - El script escribe directo en la base: no llama a la API, así que no dispara mensajes.
 *
 * Todo queda en sucursales propias ("🧪 Carga …", id que empieza con "carga-") y usuarios
 * con correo @carga.local, para poder borrarlo sin tocar tus datos (--borrar).
 * Los técnicos de carga no pueden iniciar sesión (contraseña al azar y sin celular).
 *
 * Por seguridad no corre con NODE_ENV=production salvo que agregues --forzar.
 */
import "dotenv/config";
import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const LEVELS: Record<string, number> = { chico: 1_000, medio: 10_000, grande: 50_000, enorme: 200_000 };
const ORDERS = Math.max(10, Number(value("ordenes")) || LEVELS[value("nivel") || "medio"] || LEVELS.medio);
const BRANCHES = 3;
const BATCH = 1000;
const MARK = "carga-";
const MAIL = "@carga.local";
const REPLACE = flag("reemplazar");
const CONFIRM = flag("confirmar");
/** --reemplazar: OT-1, COT-1, CL-1… como el sistema. Normal: OT-900001… para no chocar con tus códigos. */
const docCode = (prefix: string, n: number) => (REPLACE ? `${prefix}-${n}` : `${prefix}-9${String(n).padStart(prefix === "OT" ? 5 : 4, "0")}`);

// ── Datos falsos (sin números de teléfono) ──
const FIRST = ["Ana", "Luis", "María", "Jorge", "Carla", "Pedro", "Lucía", "Diego", "Sofía", "Andrés", "Valeria", "Mateo", "Camila", "Rodrigo", "Paola", "Bruno", "Elena", "Iván", "Rocío", "Tomás"];
const LAST = ["Prueba", "Demo", "Carga", "Ensayo", "Ficticio", "Ejemplo", "Test", "Simulado"];
const DEVICES: [string, string[], string[]][] = [
  ["Celular", ["Samsung", "Xiaomi", "Motorola", "Apple", "Huawei"], ["A52", "Redmi Note 12", "Moto G54", "iPhone 11", "P30 Lite"]],
  ["Laptop", ["HP", "Dell", "Lenovo", "Asus", "Acer"], ["Pavilion 15", "Inspiron 3501", "IdeaPad 3", "VivoBook 15", "Aspire 5"]],
  ["PC", ["Armada", "HP", "Dell"], ["Torre i5", "ProDesk 400", "OptiPlex 3080"]],
  ["Consola", ["Sony", "Nintendo", "Microsoft"], ["PS4", "Switch", "Xbox One"]],
  ["Tablet", ["Samsung", "Apple", "Lenovo"], ["Tab A8", "iPad 9", "Tab M10"]],
  ["Impresora", ["Epson", "HP", "Canon"], ["L3150", "DeskJet 2775", "G3110"]],
];
const ISSUES = ["No enciende", "Pantalla rota", "No carga", "Se calienta mucho", "Muy lenta", "No da imagen", "Teclado no responde", "Se reinicia sola", "Mancha en la pantalla", "No lee el chip", "Puerto de carga flojo", "Batería se descarga rápido"];
const ACCESSORIES = ["Cargador", "Batería", "Funda", "Chip / SIM", "Cable de Poder", "Maletín/Bolsa"];
const STATUS_FLOW = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];
const COMMENTS = ["Muy buena atención, lo recomiendo.", "Rápido y con buen precio.", "Me avisaron cuando estaba listo.", "Quedó como nuevo.", "Tardó un poco pero bien.", "Excelente servicio, gracias."];
const CATEGORIES = ["Pantallas", "Baterías", "Cargadores", "Discos / SSD", "Memorias RAM", "Teclados", "Cables", "Accesorios"];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const int = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000 - int(0, 86_399) * 1000);
const fakeName = () => `${pick(FIRST)} ${pick(LAST)}`;

async function inBatches<T>(rows: T[], label: string, write: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await write(rows.slice(i, i + BATCH));
    process.stdout.write(`\r   ${label}: ${Math.min(i + BATCH, rows.length).toLocaleString("es-BO")} / ${rows.length.toLocaleString("es-BO")}   `);
  }
  if (rows.length) process.stdout.write("\n");
}

async function wipe(prisma: PrismaClient) {
  const branches = await prisma.branch.findMany({ where: { id: { startsWith: MARK } }, select: { id: true } });
  const branchIds = branches.map((b) => b.id);
  const users = await prisma.user.findMany({ where: { email: { endsWith: MAIL } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (!branchIds.length && !userIds.length) { console.log("No hay datos de carga para borrar."); return; }
  console.log(`🧹 Borrando datos de carga: ${branchIds.length} sucursales, ${userIds.length} usuarios…`);
  // Órdenes de las sucursales de carga y las creadas por técnicos de prueba (modo --reemplazar)
  const repairs = await prisma.repair.findMany({ where: { OR: [{ branchId: { in: branchIds } }, { userId: { in: userIds } }] }, select: { id: true } });
  await prisma.repair.updateMany({ where: { technicianId: { in: userIds } }, data: { technicianId: null } });
  const repairIds = repairs.map((r) => r.id);
  for (let i = 0; i < repairIds.length; i += 5000) {
    const chunk = repairIds.slice(i, i + 5000);
    await prisma.statusHistory.deleteMany({ where: { repairId: { in: chunk } } });
    await prisma.message.deleteMany({ where: { repairId: { in: chunk } } });
    await prisma.review.deleteMany({ where: { repairId: { in: chunk } } });
    await prisma.repairLog.deleteMany({ where: { repairId: { in: chunk } } });
    await prisma.repair.deleteMany({ where: { id: { in: chunk } } });
  }
  const where = { branchId: { in: branchIds } };
  await prisma.message.deleteMany({ where: { OR: [where, { userId: { in: userIds } }] } });
  await prisma.review.deleteMany({ where });
  await prisma.repairLog.deleteMany({ where });
  await prisma.notification.deleteMany({ where: { OR: [where, { userId: { in: userIds } }] } });
  await prisma.cashMovement.deleteMany({ where });
  await prisma.quotation.deleteMany({ where: { OR: [where, { userId: { in: userIds } }] } });
  await prisma.certificate.deleteMany({ where: { OR: [where, { userId: { in: userIds } }] } });
  await prisma.repair.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.inventoryItem.deleteMany({ where });
  await prisma.service.deleteMany({ where });
  await prisma.software.deleteMany({ where });
  await prisma.videogame.deleteMany({ where });
  await prisma.equipment.deleteMany({ where });
  await prisma.console.deleteMany({ where });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  console.log("✅ Listo: se quitaron todos los datos de carga.");
}

/** Modo --reemplazar: borra el movimiento y el catálogo actuales (conserva usuarios, sucursales y Configuración). */
async function wipeAll(prisma: PrismaClient): Promise<boolean> {
  const counts: [string, number][] = [
    ["Órdenes (OT)", await prisma.repair.count()],
    ["Historial de estados", await prisma.statusHistory.count()],
    ["Bitácora técnica", await prisma.repairLog.count()],
    ["Reseñas", await prisma.review.count()],
    ["Cotizaciones y notas de venta", await prisma.quotation.count()],
    ["Certificados", await prisma.certificate.count()],
    ["Movimientos de caja", await prisma.cashMovement.count()],
    ["Cierres de caja", await prisma.cashClosing.count()],
    ["Citas", await prisma.appointment.count()],
    ["Notificaciones y mensajes", (await prisma.notification.count()) + (await prisma.message.count())],
    ["Inventario y repuestos", await prisma.inventoryItem.count()],
    ["Equipos, consolas, programas, juegos y servicios", (await prisma.equipment.count()) + (await prisma.console.count()) + (await prisma.software.count()) + (await prisma.videogame.count()) + (await prisma.service.count())],
  ];
  console.log(CONFIRM ? "\n🧹 Se borra lo que tienes ahora:\n" : "\n🔎 Vista previa: esto se BORRARÍA para empezar desde OT-1 (no se toca nada todavía):\n");
  for (const [label, n] of counts) console.log(`   ${String(n).padStart(7)}  ${label}`);
  console.log("\n   Se conservan: usuarios, sucursales, Configuración y categorías.");
  if (!CONFIRM) {
    console.log(`\n   Para hacerlo de verdad agrega --confirmar:  npx tsx scripts/seed-carga.ts ${[...args, "--confirmar"].join(" ")}\n`);
    return false;
  }
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
    await tx.cashClosing.deleteMany();
    await tx.appointment.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.serialUnit.deleteMany();
    await tx.inventoryItem.deleteMany();
    await tx.repair.deleteMany();
    await tx.equipment.deleteMany();
    await tx.console.deleteMany();
    await tx.software.deleteMany();
    await tx.videogame.deleteMany();
    await tx.service.deleteMany();
  }, { timeout: 300_000 });
  return true;
}

async function seed(prisma: PrismaClient) {
  const exists = await prisma.branch.count({ where: { id: { startsWith: MARK } } });
  if (exists && !REPLACE) { console.error("❌ Ya hay datos de carga. Bórralos primero con --borrar (o usa --reemplazar)."); process.exit(1); }
  if (REPLACE) {
    if (!(await wipeAll(prisma))) return;
    if (exists) await wipe(prisma);
  }

  const t0 = Date.now();
  const hours = JSON.stringify({ week: { from: "08:30", to: "19:00" }, sat: { from: "09:00", to: "13:00" }, sun: null });
  const pw = await bcrypt.hash(randomBytes(24).toString("hex"), 4);
  const techs: { id: string; name: string; branchId: string }[] = [];
  const creators = new Map<string, string>();
  let branchIds: string[] = [];

  if (REPLACE) {
    // Tus sucursales y usuarios de siempre; códigos desde OT-1 como lo hace el sistema
    const branches = await prisma.branch.findMany({ where: { active: true }, select: { id: true } });
    branchIds = branches.map((b) => b.id);
    if (!branchIds.length) {
      branchIds = [`${MARK}1`];
      await prisma.branch.create({ data: { id: branchIds[0], name: "🧪 Carga Centro", address: "Calle de prueba 100", phone: null, hours } });
    }
    const staff = await prisma.user.findMany({ where: { status: "active" }, select: { id: true, name: true, role: true, branchId: true } });
    const supers = staff.filter((u) => u.role === "superadmin");
    for (const b of branchIds) {
      const own = staff.filter((u) => u.branchId === b);
      own.filter((u) => u.role === "tech").forEach((u) => techs.push({ id: u.id, name: u.name, branchId: b }));
      creators.set(b, (own.find((u) => u.role === "admin") || own[0] || supers[0])?.id || "");
    }
  } else {
    branchIds = Array.from({ length: BRANCHES }, (_, i) => `${MARK}${i + 1}`);
    await prisma.branch.createMany({
      data: branchIds.map((id, i) => ({ id, name: `🧪 Carga ${["Centro", "Norte", "Sur", "Este", "Oeste"][i] || i + 1}`, address: `Calle de prueba ${100 + i}`, phone: null, hours })),
    });
  }

  // Sucursales sin técnicos: se agregan técnicos de prueba (sin celular ni correo real; contraseña al azar → no pueden entrar)
  const newTechs: { id: string; name: string; branchId: string }[] = [];
  for (const branchId of branchIds) {
    if (techs.some((t) => t.branchId === branchId)) continue;
    for (let i = 1; i <= (REPLACE ? 3 : 6); i++) newTechs.push({ id: randomUUID(), name: `Técnico de prueba ${i}`, branchId });
  }
  if (newTechs.length) {
    const taken = await prisma.user.count({ where: { email: { endsWith: MAIL } } });
    await prisma.user.createMany({
      data: newTechs.map((t, i) => ({ id: t.id, name: t.name, email: `tec${taken + i + 1}${MAIL}`, password: pw, role: "tech", status: "active", phone: null, branchId: t.branchId })),
    });
    techs.push(...newTechs);
  }
  const techsOf = (b: string) => techs.filter((t) => t.branchId === b);
  const creatorOf = (b: string) => creators.get(b) || techsOf(b)[0].id;
  const perBranch = Math.ceil(ORDERS / branchIds.length);
  console.log(`\n🧪 Creando ~${ORDERS.toLocaleString("es-BO")} órdenes en ${branchIds.length} ${branchIds.length === 1 ? "sucursal" : "sucursales"}${REPLACE ? " (desde OT-1)" : " de prueba"}…`);

  // Catálogo por sucursal
  const scale = Math.max(1, Math.round(ORDERS / 10_000));
  const services: { branchId: string; name: string; price: number }[] = [];
  const catalog = {
    inventory: [] as object[], software: [] as object[], videogames: [] as object[], equipment: [] as object[], consoles: [] as object[],
  };
  for (const branchId of branchIds) {
    ["Cambio de pantalla", "Cambio de batería", "Limpieza de puerto", "Formateo", "Mantenimiento", "Cambio de teclado", "Reballing", "Diagnóstico", "Instalación de programas", "Recuperar datos", "Cambio de pin de carga", "Limpieza interna", "Cambio de disco", "Ampliar memoria", "Configuración"]
      .forEach((name, i) => services.push({ branchId, name, price: 30 + i * 15 }));
    for (let i = 0; i < 150 * scale; i++) {
      const cost = int(10, 400);
      catalog.inventory.push({ name: `Producto de prueba ${i + 1}`, category: pick(CATEGORIES), quantity: int(0, 60), price: Math.round(cost * 1.4), cost, minStock: 3, kind: i % 3 === 0 ? "part" : "product", branchId });
    }
    for (let i = 0; i < 40; i++) catalog.software.push({ name: `Programa de prueba ${i + 1}`, category: pick(["Office", "Diseño", "Antivirus", "Utilidades"]), price: int(20, 80), branchId });
    for (let i = 0; i < 60; i++) catalog.videogames.push({ name: `Juego de prueba ${i + 1}`, platform: pick(["PC", "Nintendo Switch", "PSP"]), genre: pick(["Acción", "RPG", "Deportes"]), price: int(20, 70), branchId });
    for (let i = 0; i < 25; i++) catalog.equipment.push({ code: docCode("EQ", i + 1), name: `Laptop de prueba ${i + 1}`, type: i % 4 === 0 ? "desktop" : "laptop", brand: pick(["HP", "Dell", "Lenovo"]), model: `Modelo ${i + 1}`, processor: "Intel Core i5", ram: "8 GB", storage: "256 GB SSD", price: int(1800, 6000), branchId });
    for (let i = 0; i < 15; i++) catalog.consoles.push({ code: docCode("CN", i + 1), name: `Consola de prueba ${i + 1}`, category: pick(["Nintendo", "Sony", "Microsoft"]), state: pick(["Nueva", "Usada"]), price: int(900, 4500), branchId });
  }
  await prisma.service.createMany({ data: services });
  await inBatches(catalog.inventory, "Inventario", (c) => prisma.inventoryItem.createMany({ data: c as never }));
  await prisma.software.createMany({ data: catalog.software as never });
  await prisma.videogame.createMany({ data: catalog.videogames as never });
  await prisma.equipment.createMany({ data: catalog.equipment as never });
  await prisma.console.createMany({ data: catalog.consoles as never });

  // Órdenes de trabajo (sin celular ni correo del cliente)
  const repairs: Prisma.RepairCreateManyInput[] = [];
  const history: object[] = [];
  const logs: object[] = [];
  const reviews: object[] = [];
  for (const branchId of branchIds) {
    const bTechs = techsOf(branchId);
    for (let n = 1; n <= perBranch; n++) {
      const id = randomUUID();
      const code = docCode("OT", n);
      const [device, brands, models] = pick(DEVICES);
      const age = int(0, 365);
      const created = daysAgo(age);
      // Las órdenes viejas casi siempre están entregadas; las recientes, en cualquier etapa
      const statusIdx = age > 30 ? (Math.random() < 0.92 ? 5 : int(0, 4)) : int(0, 5);
      const status = STATUS_FLOW[statusIdx];
      const tech = Math.random() < 0.85 ? pick(bTechs) : null;
      const svc = services.filter((s) => s.branchId === branchId);
      const chosen = Array.from(new Set(Array.from({ length: int(0, 2) }, () => pick(svc).name)));
      const cost = chosen.reduce((s, name) => s + (svc.find((x) => x.name === name)?.price || 0), 0) || int(50, 900);
      const acc = ACCESSORIES.filter(() => Math.random() < 0.25);
      const delivered = status === "delivered" ? new Date(Math.min(Date.now(), created.getTime() + int(1, 12) * 86_400_000)) : null;
      repairs.push({
        id, code, qrCode: code, device, brand: pick(brands), model: pick(models), issue: pick(ISSUES), status,
        priority: pick(["media", "media", "media", "alta", "urgente"]), estimatedCost: cost,
        notes: chosen.length ? `Servicios: ${chosen.join(", ")}` : null,
        clientName: fakeName(), clientPhone: null, clientEmail: null,
        accessories: acc.length ? JSON.stringify(acc) : null,
        userId: creatorOf(branchId), technicianId: tech?.id ?? null, branchId,
        createdAt: created, updatedAt: delivered || created, deliveredAt: delivered, paidWith: delivered ? pick(["cash", "qr"]) : null,
      });
      for (let s = 1; s <= statusIdx; s++) {
        history.push({ repairId: id, fromStatus: STATUS_FLOW[s - 1], toStatus: STATUS_FLOW[s], changedBy: tech?.id ?? null, changedByName: tech?.name ?? "Sistema", createdAt: new Date(created.getTime() + s * 3_600_000) });
      }
      if (tech && Math.random() < 0.3) {
        logs.push({ repairId: id, branchId, authorId: tech.id, authorName: tech.name, authorRole: "tech", type: "note", text: "Nota de prueba: revisado y en espera.", visibleToClient: Math.random() < 0.5, createdAt: new Date(created.getTime() + 7_200_000) });
      }
      if (delivered && Math.random() < 0.4) {
        reviews.push({ repairId: id, repairCode: code, rating: pick([5, 5, 5, 4, 4, 3, 2]), comment: Math.random() < 0.6 ? pick(COMMENTS) : null, clientName: null, branchId, createdAt: new Date(delivered.getTime() + 86_400_000) });
      }
    }
  }
  await inBatches(repairs, "Órdenes", (c) => prisma.repair.createMany({ data: c }));
  await inBatches(history, "Historial de estados", (c) => prisma.statusHistory.createMany({ data: c as never }));
  await inBatches(logs, "Bitácora técnica", (c) => prisma.repairLog.createMany({ data: c as never }));
  await inBatches(reviews, "Reseñas", (c) => prisma.review.createMany({ data: c as never }));

  // Cotizaciones / notas de venta, caja, certificados y avisos
  const quotes: object[] = [];
  const cash: object[] = [];
  const certs: object[] = [];
  const notes: object[] = [];
  for (const branchId of branchIds) {
    const bTechs = techsOf(branchId);
    let nCot = 0, nNv = 0;
    for (let i = 1; i <= Math.ceil(perBranch / 8); i++) {
      const items = Array.from({ length: int(1, 4) }, (_, k) => ({ name: `Artículo de prueba ${k + 1}`, price: int(20, 500), qty: int(1, 3), kind: pick(["inventory", "service", "software"]) }));
      const total = items.reduce((s, it) => s + it.price * it.qty, 0);
      const sale = Math.random() < 0.5;
      quotes.push({ code: sale ? docCode("NV", ++nNv) : docCode("COT", ++nCot), type: sale ? "sale" : "quotation", clientName: fakeName(), clientPhone: null, items: JSON.stringify(items), total, paidWith: sale ? pick(["cash", "qr"]) : null, branchId, userId: creatorOf(branchId), createdAt: daysAgo(int(0, 365)) });
    }
    for (let i = 0; i < Math.ceil(perBranch / 4); i++) {
      const income = Math.random() < 0.7;
      cash.push({ type: income ? "income" : "expense", category: income ? pick(["servicios", "ventas"]) : pick(["repuestos", "pagos", "otros"]), amount: int(10, 900), description: income ? "Cobro de prueba" : "Gasto de prueba", branchId, createdByName: "Carga", createdAt: daysAgo(int(0, 365)) });
    }
    for (let i = 1; i <= 50; i++) {
      certs.push({ code: docCode("CL", i), clientName: fakeName(), computerName: `PC-PRUEBA-${i}`, windowsEdition: "Windows 11 Pro", windowsSerial: "XXXXX-XXXXX-XXXXX-XXXXX-PRUEB", date: new Date().toISOString().slice(0, 10), technician: bTechs[0].name, branchId, userId: creatorOf(branchId) });
    }
    for (const t of bTechs) for (let i = 0; i < 40; i++) {
      notes.push({ type: "info", title: "Aviso de prueba", message: "Generado por la prueba de carga.", read: Math.random() < 0.7, userId: t.id, branchId, createdAt: daysAgo(int(0, 60)) });
    }
  }
  await inBatches(quotes, "Cotizaciones y notas de venta", (c) => prisma.quotation.createMany({ data: c as never }));
  await inBatches(cash, "Movimientos de caja", (c) => prisma.cashMovement.createMany({ data: c as never }));
  await prisma.certificate.createMany({ data: certs as never });
  await inBatches(notes, "Avisos", (c) => prisma.notification.createMany({ data: c as never }));

  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n✅ Prueba de carga lista en ${secs} s:`);
  console.log(`   ${repairs.length.toLocaleString("es-BO")} órdenes · ${history.length.toLocaleString("es-BO")} cambios de estado · ${reviews.length.toLocaleString("es-BO")} reseñas`);
  console.log(`   ${catalog.inventory.length.toLocaleString("es-BO")} productos · ${quotes.length.toLocaleString("es-BO")} cotizaciones/ventas · ${cash.length.toLocaleString("es-BO")} movimientos de caja`);
  console.log(REPLACE ? `   En tus sucursales, desde OT-1. Los clientes no tienen celular ni correo.` : `   Sucursales: ${branchIds.join(", ")} (aparecen como "🧪 Carga …"). Para quitar todo: npx tsx scripts/seed-carga.ts --borrar`);
}

async function main() {
  if (process.env.NODE_ENV === "production" && !flag("forzar")) {
    console.error("❌ NODE_ENV=production: este script es para pruebas. Si de verdad quieres correrlo aquí, agrega --forzar.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) { console.error("❌ Falta DATABASE_URL (archivo .env)."); process.exit(1); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL!).host; } catch { return "?"; } })();
  console.log(`Base de datos: ${host}`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (flag("borrar")) await wipe(prisma);
    else await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("\n❌ Error:", e?.message || e); process.exit(1); });

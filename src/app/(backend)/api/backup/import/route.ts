/* eslint-disable @typescript-eslint/no-explicit-any -- las filas vienen de un archivo de respaldo (JSON sin tipo); Prisma valida cada campo al crear */
import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import { requireAuth, ROLES } from "@/backend/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomPassword } from "@/backend/secure";
import { isSecretKey } from "@/backend/automation";

type Stat = { found: number; added: number; skipped: number };

/** Solo imágenes subidas al propio sistema (evita URLs externas de rastreo en <img>). */
const safeImage = (v: unknown) => (typeof v === "string" && v.startsWith("/uploads/") ? v : null);

// Importación de un respaldo JSON (solo Super Admin). Agrega lo que falta y salta lo que ya existe,
// así que si se corta a la mitad basta con volver a importar el mismo archivo.
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Solo el Super Admin puede importar backups" }, { status: 403 });
    }

    const backup = await request.json();
    if (!backup?.data || !backup?.meta?.version) {
      return NextResponse.json({ error: "Archivo de backup inválido" }, { status: 400 });
    }

    const data = backup.data;
    const stats: Record<string, Stat> = {};

    async function importIfMissing<T extends { id: string }>(
      tableName: string,
      records: T[],
      findFn: (record: T) => Promise<unknown>,
      createFn: (record: T) => Promise<unknown>
    ) {
      const stat: Stat = (stats[tableName] = { found: 0, added: 0, skipped: 0 });
      if (!Array.isArray(records)) return;
      stat.found = records.length;

      for (const record of records) {
        try {
          if (await findFn(record)) {
            stat.skipped++;
          } else {
            await createFn(record);
            stat.added++;
          }
        } catch (err) {
          console.error(`[Importar] ${tableName} id=${record?.id}:`, errMsg(err));
          stat.skipped++;
        }
      }
    }

    // 1. Sucursales
    await importIfMissing(
      "branches",
      data.branches || [],
      (r) => prisma.branch.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.branch.create({
        data: {
          id: r.id,
          name: r.name,
          address: r.address || null,
          phone: r.phone || null,
          active: r.active ?? true,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 2. Usuarios: el respaldo no trae contraseñas. Cada uno recibe una aleatoria que nadie conoce,
    // queda pendiente de aprobación y debe usar "¿Olvidaste tu contraseña?" (o el Super Admin le da una temporal).
    await importIfMissing(
      "users",
      data.users || [],
      (r: any) => prisma.user.findFirst({
        where: { OR: [{ id: r.id }, { email: { equals: String(r.email ?? "").trim(), mode: "insensitive" } }] },
        select: { id: true },
      }),
      async (r: any) => prisma.user.create({
        data: {
          id: r.id,
          name: String(r.name ?? "").trim().slice(0, 100),
          email: String(r.email ?? "").trim().toLowerCase(),
          password: await bcrypt.hash(randomPassword(24), 10),
          role: (ROLES as readonly string[]).includes(r.role) ? r.role : "tech",
          status: "pending",
          mustChangePassword: true,
          phone: typeof r.phone === "string" ? r.phone : null,
          image: safeImage(r.image),
          branchId: r.branchId || null,
          createdAt: new Date(r.createdAt),
        },
      })
    );

    // 3. Órdenes
    await importIfMissing(
      "repairs",
      data.repairs || [],
      (r) => prisma.repair.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.repair.create({
        data: {
          id: r.id,
          code: r.code,
          device: r.device,
          issue: r.issue,
          status: r.status || "pending",
          priority: r.priority || "media",
          estimatedCost: r.estimatedCost || 0,
          notes: r.notes || null,
          qrCode: r.qrCode,
          image: safeImage(r.image),
          brand: r.brand || null,
          clientEmail: r.clientEmail || null,
          clientName: r.clientName || null,
          clientPhone: r.clientPhone || null,
          model: r.model || null,
          accessories: r.accessories || null,
          technicianId: r.technicianId || null,
          deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : (r.status === "delivered" ? new Date(r.updatedAt || r.createdAt) : null),
          signature: typeof r.signature === "string" && r.signature.startsWith("data:image/png;base64,") && r.signature.length <= 200_000 ? r.signature : null,
          signedAt: r.signedAt ? new Date(r.signedAt) : null,
          warrantyOf: typeof r.warrantyOf === "string" ? r.warrantyOf.slice(0, 40) : null,
          remindedAt: r.remindedAt ? new Date(r.remindedAt) : null,
          reminders: Number.isInteger(r.reminders) ? r.reminders : 0,
          userId: r.userId,
          branchId: r.branchId,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 4. Servicios
    await importIfMissing(
      "services",
      data.services || [],
      (r) => prisma.service.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.service.create({
        data: {
          id: r.id,
          name: r.name,
          price: r.price,
          icon: r.icon || "🔧",
          active: r.active ?? true,
          branchId: r.branchId,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 5. Inventario (los números de serie van después)
    await importIfMissing(
      "inventoryItems",
      data.inventoryItems || [],
      (r) => prisma.inventoryItem.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.inventoryItem.create({
        data: {
          id: r.id,
          name: r.name,
          category: r.category || null,
          quantity: r.quantity || 0,
          price: r.price || 0,
          minStock: r.minStock || 5,
          active: r.active ?? true,
          showInPortal: r.showInPortal ?? true,
          kind: r.kind === "part" ? "part" : "product",
          branchId: r.branchId,
          image: safeImage(r.image),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 6. Números de serie
    await importIfMissing(
      "serialUnits",
      data.serialUnits || [],
      (r) => prisma.serialUnit.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.serialUnit.create({
        data: {
          id: r.id,
          serialNumber: r.serialNumber,
          status: r.status || "available",
          inventoryItemId: r.inventoryItemId,
          soldTo: r.soldTo || null,
          soldAt: r.soldAt ? new Date(r.soldAt) : null,
          repairCode: r.repairCode || null,
          notes: r.notes || null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 7. Software
    await importIfMissing(
      "software",
      data.software || [],
      (r) => prisma.software.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.software.create({
        data: {
          id: r.id,
          showInPortal: r.showInPortal ?? true,
          name: r.name,
          category: r.category || null,
          image: safeImage(r.image),
          active: r.active ?? true,
          branchId: r.branchId,
          minRequirements: r.minRequirements || null,
          recRequirements: r.recRequirements || null,
          size: r.size || null,
          description: r.description || null,
          language: r.language || null,
          rating: r.rating || null,
          price: typeof r.price === "number" ? r.price : null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 8. Cotizaciones y notas de venta
    await importIfMissing(
      "quotations",
      data.quotations || [],
      (r) => prisma.quotation.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.quotation.create({
        data: {
          id: r.id,
          code: r.code,
          type: r.type || "quotation",
          clientName: r.clientName,
          clientPhone: r.clientPhone || null,
          items: r.items,
          total: r.total || 0,
          notes: r.notes || null,
          branchId: r.branchId,
          userId: r.userId,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 9. Notificaciones
    await importIfMissing(
      "notifications",
      data.notifications || [],
      (r) => prisma.notification.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.notification.create({
        data: {
          id: r.id,
          type: r.type,
          title: r.title,
          message: r.message,
          read: r.read ?? false,
          userId: r.userId,
          branchId: r.branchId,
          createdAt: new Date(r.createdAt),
        },
      })
    );

    // 10. Certificados
    await importIfMissing(
      "certificates",
      data.certificates || [],
      (r) => prisma.certificate.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.certificate.create({
        data: {
          id: r.id,
          code: r.code,
          clientName: r.clientName,
          computerName: r.computerName || null,
          windowsEdition: r.windowsEdition || null,
          windowsSerial: r.windowsSerial || null,
          officeEdition: r.officeEdition || null,
          officeSerial: r.officeSerial || null,
          date: r.date,
          technician: r.technician || "",
          notes: r.notes || null,
          branchId: r.branchId,
          userId: r.userId,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt || r.createdAt),
        },
      })
    );

    // 11. Configuración
    await importIfMissing(
      "settings",
      data.settings || [],
      (r) => prisma.settings.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.settings.create({
        data: {
          id: r.id,
          companyName: r.companyName || "RepairTrackQR",
          slogan: r.slogan || "Servicio Técnico Especializado",
          logo: r.logo || null,
          phone: r.phone || null,
          email: r.email || null,
          address: r.address || null,
          website: r.website || null,
          city: r.city || null,
          terms: r.terms || null,
          publicUrl: r.publicUrl || null,
          ...(Number.isInteger(r.warrantyDays) && { warrantyDays: r.warrantyDays }),
          ...(Number.isInteger(r.abandonDays) && { abandonDays: r.abandonDays }),
        },
      })
    );

    // 12. Equipos
    await importIfMissing("equipment", data.equipment || [],
      (r) => prisma.equipment.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.equipment.create({ data: {
        id: r.id,
          showInPortal: r.showInPortal ?? true, code: r.code || "", name: r.name, type: r.type || "laptop", brand: r.brand ?? null, model: r.model ?? null,
        processor: r.processor ?? null, ram: r.ram ?? null, storage: r.storage ?? null, storage2: r.storage2 ?? null,
        screenSize: r.screenSize ?? null, graphicsCard: r.graphicsCard ?? null, os: r.os ?? null, cabinet: r.cabinet ?? null,
        powerSupply: r.powerSupply ?? null, motherboard: r.motherboard ?? null, accessories: r.accessories ?? null,
        condition: r.condition || "disponible", price: Number(r.price) || 0, notes: r.notes ?? null, image: safeImage(r.image),
        branchId: r.branchId, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt || r.createdAt),
      } })
    );

    // 13. Consolas
    await importIfMissing("consoles", data.consoles || [],
      (r) => prisma.console.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.console.create({ data: {
        id: r.id,
          showInPortal: r.showInPortal ?? true, code: r.code || "", name: r.name, category: r.category ?? null, state: r.state ?? null, brand: r.brand ?? null,
        model: r.model ?? null, color: r.color ?? null, storage: r.storage ?? null, generation: r.generation ?? null,
        accessories: r.accessories ?? null, condition: r.condition || "disponible", price: Number(r.price) || 0,
        notes: r.notes ?? null, image: safeImage(r.image), active: r.active ?? true, branchId: r.branchId,
        createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt || r.createdAt),
      } })
    );

    // 14. Videojuegos
    await importIfMissing("videogames", data.videogames || [],
      (r) => prisma.videogame.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.videogame.create({ data: {
        id: r.id,
          showInPortal: r.showInPortal ?? true, name: r.name, platform: r.platform ?? null, genre: r.genre ?? null, description: r.description ?? null,
        size: r.size ?? null, minRequirements: r.minRequirements ?? null, recRequirements: r.recRequirements ?? null,
        language: r.language ?? null, rating: r.rating ?? null, image: safeImage(r.image), active: r.active ?? true,
        price: typeof r.price === "number" ? r.price : null,
        branchId: r.branchId, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt || r.createdAt),
      } })
    );

    // 15. Caja
    await importIfMissing("cashMovements", data.cashMovements || [],
      (r) => prisma.cashMovement.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.cashMovement.create({ data: {
        id: r.id, type: r.type, category: r.category || "otros", amount: Number(r.amount) || 0, description: r.description || "",
        notes: r.notes ?? null, createdBy: r.createdBy ?? null, createdByName: r.createdByName ?? null, branchId: r.branchId,
        createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt || r.createdAt),
      } })
    );

    // 16. Reseñas
    await importIfMissing("reviews", data.reviews || [],
      (r) => prisma.review.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.review.create({ data: {
        id: r.id, repairId: r.repairId, repairCode: r.repairCode, rating: Number(r.rating) || 5, comment: r.comment ?? null,
        clientName: r.clientName ?? null, branchId: r.branchId, createdAt: new Date(r.createdAt),
      } })
    );

    // 17. Historial de estados
    await importIfMissing("statusHistory", data.statusHistory || [],
      (r) => prisma.statusHistory.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.statusHistory.create({ data: {
        id: r.id, repairId: r.repairId, fromStatus: r.fromStatus ?? null, toStatus: r.toStatus, changedBy: r.changedBy ?? null,
        changedByName: r.changedByName ?? null, notes: r.notes ?? null, createdAt: new Date(r.createdAt),
      } })
    );

    // 18. Categorías personalizadas (KeyValue usa "key" como id; nunca claves de servicios)
    await importIfMissing("keyValues", (data.keyValues || []).filter((r: any) => typeof r?.key === "string" && !isSecretKey(r.key)).map((r: any) => ({ ...r, id: r.key })),
      (r) => prisma.keyValue.findUnique({ where: { key: r.key } }),
      (r: any) => prisma.keyValue.create({ data: { key: r.key, value: String(r.value ?? "") } })
    );

    // 19. Bitácora técnica (después de las órdenes)
    await importIfMissing("repairLogs", data.repairLogs || [],
      (r) => prisma.repairLog.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.repairLog.create({ data: {
        id: r.id, repairId: r.repairId, branchId: r.branchId, authorId: r.authorId, authorName: r.authorName, authorRole: r.authorRole,
        type: r.type, text: r.text, images: r.images ?? null, visibleToClient: !!r.visibleToClient, hidden: !!r.hidden,
        hiddenById: r.hiddenById ?? null, status: r.status ?? null, recordedById: r.recordedById ?? null, recordedByName: r.recordedByName ?? null,
        createdAt: new Date(r.createdAt),
      } })
    );

    // 20. Chat interno
    await importIfMissing("messages", data.messages || [],
      (r) => prisma.message.findUnique({ where: { id: r.id } }),
      (r: any) => prisma.message.create({ data: {
        id: r.id, text: r.text, images: r.images ?? null, read: !!r.read, repairId: r.repairId ?? null, userId: r.userId, branchId: r.branchId,
        createdAt: new Date(r.createdAt),
      } })
    );

    return NextResponse.json({
      success: true,
      message: "Importación completada",
      stats,
    });
  } catch (error) {
    if (errMsg(error) === "NO_AUTH") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.error("Import error:", error);
    return NextResponse.json({ error: "Error al importar backup" }, { status: 500 });
  }
}

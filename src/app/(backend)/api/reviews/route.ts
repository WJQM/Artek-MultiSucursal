import { prisma } from "@/backend/prisma";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/backend/rate-limit";
import { trackTokenRepairId, readTrackToken } from "@/backend/track-access";
import { googleLinkFor } from "@/backend/google-reviews";

// GET /api/reviews?repairId=uuid  (o ?repairCode=OT-5, compatibilidad) — ¿ya tiene reseña?
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const repairId = url.searchParams.get("repairId");
    const repairCode = url.searchParams.get("repairCode");

    let review = null;
    if (repairId) {
      review = await prisma.review.findUnique({ where: { repairId } });
    } else if (repairCode) {
      review = await prisma.review.findFirst({ where: { repairCode: repairCode.toUpperCase() } });
    }
    // ¿La sucursal tiene enlace de reseñas en Google? (el botón se muestra a todos después de calificar)
    const rep = repairId
      ? await prisma.repair.findUnique({ where: { id: repairId }, select: { id: true, branchId: true } })
      : repairCode ? await prisma.repair.findFirst({ where: { code: repairCode.toUpperCase() }, select: { id: true, branchId: true } }) : null;
    const google = rep && (await googleLinkFor(rep.branchId)) ? `/api/reviews/google/go?r=${encodeURIComponent(rep.id)}` : null;
    // Solo lo necesario para mostrar "ya calificado"
    return NextResponse.json({ review: review ? { rating: review.rating, comment: review.comment, createdAt: review.createdAt } : null, google });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/reviews — crear reseña (público)
export async function POST(request: Request) {
  const rl = rateLimit(`review:${getClientIp(request)}`, 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados intentos, intenta más tarde" }, { status: 429 });

  try {
    const body = await request.json();
    const repairId = typeof body.repairId === "string" ? body.repairId : null;
    const code = String(body.repairCode || "").trim().toUpperCase();
    const rating = parseInt(String(body.rating || 0));
    const comment = body.comment ? String(body.comment).trim().substring(0, 500) : null;

    if (!repairId && (!code || !code.startsWith("OT-"))) {
      return NextResponse.json({ error: "Código de OT inválido" }, { status: 400 });
    }
    if (!(rating >= 1 && rating <= 5)) {
      return NextResponse.json({ error: "Calificación debe ser entre 1 y 5" }, { status: 400 });
    }

    // Preferir el ID (el código OT-X se repite entre sucursales)
    const repair = await prisma.repair.findFirst({
      where: repairId ? { id: repairId, status: "delivered" } : { code, status: "delivered" },
      select: { id: true, code: true, branchId: true, clientName: true },
    });
    if (!repair) {
      return NextResponse.json({ error: "OT no encontrada o aún no entregada" }, { status: 404 });
    }

    // Solo el cliente verificado (últimos 4 dígitos del celular) puede calificar: evita reseñas falsas
    if (trackTokenRepairId(readTrackToken(request)) !== repair.id) {
      return NextResponse.json({ error: "Confirma primero que eres el cliente (últimos 4 dígitos de tu celular).", needVerify: true }, { status: 403 });
    }

    const existing = await prisma.review.findUnique({ where: { repairId: repair.id } });
    if (existing) {
      return NextResponse.json({ error: "Esta orden ya fue calificada. ¡Gracias!", alreadyReviewed: true }, { status: 409 });
    }

    await prisma.review.create({
      data: {
        repairId: repair.id,
        repairCode: repair.code,
        rating,
        comment,
        clientName: repair.clientName,
        branchId: repair.branchId,
      },
    });

    // Aviso en la campana a los administradores de la sucursal y al super admin
    try {
      const admins = await prisma.user.findMany({
        where: { status: "active", OR: [{ role: "superadmin" }, { role: "admin", branchId: repair.branchId }] },
        select: { id: true },
      });
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const who = repair.clientName ? repair.clientName.split(" ")[0] : "Un cliente";
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          type: "review",
          title: rating <= 2 ? `⚠️ Reseña baja (${rating}/5) — ${repair.code}` : `Nueva reseña ${stars} — ${repair.code}`,
          message: `${who}: ${comment ? `"${comment.slice(0, 120)}"` : "sin comentario"}`,
          userId: a.id,
          branchId: repair.branchId,
        })),
      });
      const { sendPush } = await import("@/backend/push");
      sendPush(admins.map((a) => a.id), "reviews", {
        title: rating <= 2 ? `⚠️ Reseña baja (${rating}/5) — ${repair.code}` : `⭐ Nueva reseña ${stars} — ${repair.code}`,
        body: `${who}: ${comment ? `"${comment.slice(0, 120)}"` : "sin comentario"}`,
        url: "/reviews", tag: "reviews",
      }).catch(() => 0);
    } catch (e) {
      console.error("[Review] No se pudo notificar:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Review] POST Error:", error);
    return NextResponse.json({ error: "Error al guardar reseña" }, { status: 500 });
  }
}

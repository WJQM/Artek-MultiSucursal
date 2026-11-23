import { errMsg } from "@/shared/errors";
import { prisma } from "@/backend/prisma";
import { requireAuth } from "@/backend/auth";
import { NextResponse } from "next/server";
import { invalidateSettingsCache } from "@/backend/company";
import { normalizePublicUrl } from "@/shared/branding";
import { readKV, writeKV } from "@/backend/automation";
import { getBrandColors, saveBrandColors } from "@/backend/brand-colors";
import { isHexColor, isPrintMode } from "@/shared/brand-colors";

// Foto de portada del portal (Configuración): dirección de una imagen subida, o null para el fondo azul.
// Se guarda aparte (KeyValue) para no agrandar la fila de Settings.
const COVER_KEY = "portal.cover";
const validCover = (v: unknown): v is string => typeof v === "string" && /^\/uploads\/[\w.-]+$/.test(v);

const SETTINGS_ID = "global";

// GET - Public (login page needs it too)
export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });

    // Auto-create default settings if not found
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: SETTINGS_ID,
          companyName: "RepairTrackQR",
          slogan: "Servicio Técnico Especializado",
        },
      });
    }

    const portalCover = await readKV<string | null>(COVER_KEY, null);
    return NextResponse.json({ ...settings, portalCover: validCover(portalCover) ? portalCover : null, brandColors: await getBrandColors() });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({
      id: SETTINGS_ID,
      companyName: "RepairTrackQR",
      slogan: "Servicio Técnico Especializado",
      logo: null, phone: null, email: null, address: null, website: null,
      city: null, warrantyDays: 30, abandonDays: 90, terms: null, publicUrl: null, portalCover: null,
    });
  }
}

// PUT - Superadmin only
export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Solo el Super Admin puede modificar la configuración" }, { status: 403 });
    }

    const body = await request.json();
    const { companyName, slogan, logo, phone, email, address, website } = body;
    const str = (v: unknown, max: number) => (v === null || v === undefined ? v : String(v).trim().slice(0, max) || null) as string | null | undefined;
    const days = (v: unknown) => {
      if (v === undefined) return undefined;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 && n <= 3650 ? n : null;
    };
    const city = str(body.city, 80);
    const terms = str(body.terms, 2000);
    let publicUrl: string | null | undefined = undefined;
    if (body.publicUrl !== undefined) {
      const raw = typeof body.publicUrl === "string" ? body.publicUrl.trim() : "";
      publicUrl = raw ? normalizePublicUrl(raw) : null;
      if (raw && !publicUrl) {
        return NextResponse.json({ error: "Enlace público inválido. Ejemplo: https://taller.midominio.com" }, { status: 400 });
      }
    }
    if (body.portalCover !== undefined && body.portalCover !== null && !validCover(body.portalCover)) {
      return NextResponse.json({ error: "Foto de portada inválida: vuelve a subirla" }, { status: 400 });
    }
    // Colores de la marca (Configuración › Colores): dos colores #rrggbb
    const brandColors = body.brandColors;
    if (brandColors !== undefined && !(brandColors && isHexColor(brandColors.accent) && isHexColor(brandColors.dark) && (brandColors.print === undefined || isPrintMode(brandColors.print)))) {
      return NextResponse.json({ error: "Colores inválidos: elige otra vez el color" }, { status: 400 });
    }
    const warrantyDays = days(body.warrantyDays);
    const abandonDays = days(body.abandonDays);
    if (warrantyDays === null || abandonDays === null) {
      return NextResponse.json({ error: "Los días de garantía y de abandono deben ser un número entre 0 y 3650" }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        ...(companyName !== undefined && { companyName }),
        ...(slogan !== undefined && { slogan }),
        ...(logo !== undefined && { logo }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(city !== undefined && { city }),
        ...(terms !== undefined && { terms }),
        ...(publicUrl !== undefined && { publicUrl }),
        ...(warrantyDays !== undefined && { warrantyDays }),
        ...(abandonDays !== undefined && { abandonDays }),
      },
      create: {
        id: SETTINGS_ID,
        companyName: companyName || "RepairTrackQR",
        slogan: slogan || "Servicio Técnico Especializado",
        logo, phone, email, address, website,
        city: city ?? null, terms: terms ?? null, publicUrl: publicUrl ?? null,
        ...(warrantyDays !== undefined && { warrantyDays }),
        ...(abandonDays !== undefined && { abandonDays }),
      },
    });

    if (body.portalCover !== undefined) await writeKV(COVER_KEY, body.portalCover);
    if (brandColors !== undefined) await saveBrandColors({ accent: brandColors.accent, dark: brandColors.dark, print: brandColors.print });
    invalidateSettingsCache();
    return NextResponse.json({ ...settings, portalCover: body.portalCover !== undefined ? body.portalCover : await readKV<string | null>(COVER_KEY, null), brandColors: await getBrandColors() });
  } catch (error) {
    if (errMsg(error) === "NO_AUTH") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
  }
}

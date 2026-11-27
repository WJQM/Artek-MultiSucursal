// Configuración del WhatsApp del taller (WasenderApi). Solo Super Admin; la clave nunca se devuelve completa.
import { NextResponse } from "next/server";
import { getUserFromToken, unauthorized, forbidden } from "@/backend/auth";
import { publicWhatsAppConfig, saveWhatsAppKey, sendWhatsApp } from "@/backend/whatsapp";
import { getSettings } from "@/backend/company";

async function superadmin(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return { error: unauthorized() };
  if (user.role !== "superadmin") return { error: forbidden("Solo el Super Admin") };
  return { user };
}

export async function GET(request: Request) {
  const a = await superadmin(request);
  if (a.error) return a.error;
  return NextResponse.json(await publicWhatsAppConfig());
}

export async function PUT(request: Request) {
  const a = await superadmin(request);
  if (a.error) return a.error;
  const { apiKey } = await request.json().catch(() => ({}));
  try {
    const { config, warning } = await saveWhatsAppKey(String(apiKey ?? ""));
    return NextResponse.json({ ...config, warning });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Mensaje de prueba al celular indicado
export async function POST(request: Request) {
  const a = await superadmin(request);
  if (a.error) return a.error;
  const { phone } = await request.json().catch(() => ({}));
  const s = await getSettings();
  const r = await sendWhatsApp(String(phone ?? ""), `✅ Mensaje de prueba de ${s?.companyName || "RepairTrack"}: el WhatsApp del taller está funcionando.`);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}

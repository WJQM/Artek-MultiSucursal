import { NextResponse } from "next/server";
import { turnstileSiteKey, isTurnstileEnabled } from "@/backend/turnstile";
import { whatsappConfigured } from "@/backend/whatsapp";

// Configuración pública que necesitan las pantallas de acceso (sin secretos)
export async function GET() {
  return NextResponse.json({
    turnstileSiteKey: isTurnstileEnabled() ? turnstileSiteKey() : null,
    whatsappEnabled: (await whatsappConfigured()) || process.env.NODE_ENV !== "production",
  });
}

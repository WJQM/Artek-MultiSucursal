import { NextResponse } from "next/server";
import { getUserFromToken, getEffectiveBranchId, isAdmin, unauthorized, forbidden } from "@/backend/auth";
import { buildDaySummary, summaryText } from "@/backend/daily-summary";
import { getSettings } from "@/backend/company";
import { getAutomationConfig } from "@/backend/automation";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { rateLimit } from "@/backend/rate-limit";

// Resumen del día (Caja → "Resumen del día")
//   GET  → datos + texto listo para WhatsApp
//   POST → lo envía al WhatsApp del dueño (Configuración › Tareas automáticas)
async function load(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return { error: unauthorized() };
  if (!isAdmin(user)) return { error: forbidden() };
  const summary = await buildDaySummary(getEffectiveBranchId(request, user));
  const s = await getSettings();
  return { user, summary, text: summaryText(summary, s?.companyName || "RepairTrackQR") };
}

export async function GET(request: Request) {
  const r = await load(request);
  if ("error" in r) return r.error;
  const cfg = await getAutomationConfig();
  return NextResponse.json({ summary: r.summary, text: r.text, ownerPhone: cfg.ownerPhone || null });
}

export async function POST(request: Request) {
  const r = await load(request);
  if ("error" in r) return r.error;
  const cfg = await getAutomationConfig();
  if (!cfg.ownerPhone) return NextResponse.json({ error: "Falta el celular del dueño (Configuración › Tareas automáticas)" }, { status: 400 });
  const rl = rateLimit(`summary:${r.user.id}`, 20, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados envíos, intenta más tarde" }, { status: 429 });
  const sent = await sendWhatsAppSafe(cfg.ownerPhone, r.text);
  return NextResponse.json({ sent, text: r.text, phone: cfg.ownerPhone });
}

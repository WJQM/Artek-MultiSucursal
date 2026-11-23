import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, canAccessBranch, unauthorized, forbidden, notFound } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { companyInfo } from "@/backend/company";
import { publicBaseUrl } from "@/backend/public-url";
import { fmtDateLong } from "@/backend/receipt";
import { sendWhatsApp } from "@/backend/whatsapp";
import { normalizePhone } from "@/backend/phone";

// Cotización o nota de venta por WhatsApp (personal del taller):
//   GET  ?id=…               → mensaje listo + celular del cliente (para vista previa o abrir WhatsApp)
//   POST { id, phone }       → lo envía desde el número del taller (WasenderAPI)

interface Item { name?: string; qty?: number; price?: number }
type Q = { id: string; code: string; type: string; clientName: string | null; clientPhone: string | null; items: string; total: number; createdAt: Date; branchId: string; paidWith: string | null };

async function load(request: Request, id: string) {
  const user = await getUserFromToken(request);
  if (!user) return { error: unauthorized() };
  if (user.role === "tech") return { error: forbidden("Solo administradores") };
  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) return { error: notFound("Documento no encontrado") };
  if (!canAccessBranch(user, q.branchId)) return { error: forbidden() };
  return { user, q };
}

const money = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

async function buildMessage(request: Request, q: Q) {
  const isQuot = q.type === "quotation";
  const label = isQuot ? "Cotización" : "Nota de venta";
  let items: Item[] = [];
  try { items = JSON.parse(q.items); } catch { /* items mal formados */ }
  const company = await companyInfo(publicBaseUrl(request));
  const base = company.portalUrl.replace(/\/portal$/, "");
  const url = `${base}/quotations/print/${encodeURIComponent(q.code)}?branchId=${encodeURIComponent(q.branchId)}`;
  const first = q.clientName?.trim().split(" ")[0];
  const lines = items.slice(0, 12).map((i) => `• ${i.qty && i.qty > 1 ? `${i.qty} × ` : ""}${i.name || "Ítem"} — ${money((i.price || 0) * (i.qty || 1))}`);
  if (items.length > 12) lines.push(`• … y ${items.length - 12} ítems más`);
  const parts = [
    `*${label} ${q.code}* · ${company.companyName}`,
    "",
    `Hola${first ? ` ${first}` : ""} 👋, ${isQuot ? "te enviamos la cotización que nos pediste:" : "gracias por tu compra. Este es el detalle:"}`,
    "",
    ...lines,
    "",
    `💰 *Total: ${money(q.total || 0)}*`,
  ];
  if (isQuot) parts.push(`📅 Válida hasta el ${fmtDateLong(new Date(q.createdAt.getTime() + 15 * 86_400_000))}`);
  else if (q.paidWith) parts.push(`💳 Pagado con ${q.paidWith === "qr" ? "QR" : "efectivo"}`);
  parts.push("", `📄 Ver ${label.toLowerCase()} completa:`, url, "", isQuot ? "Cualquier consulta, respóndenos por aquí. ¡Gracias!" : "Guarda este mensaje como respaldo de tu compra. ¡Gracias!");
  return parts.join("\n");
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const r = await load(request, id);
  if ("error" in r) return r.error;
  return NextResponse.json({ message: await buildMessage(request, r.q), phone: r.q.clientPhone || "" });
}

export async function POST(request: Request) {
  const { id, phone } = await request.json().catch(() => ({}));
  const r = await load(request, String(id || ""));
  if ("error" in r) return r.error;
  const to = String(phone || r.q.clientPhone || "").trim();
  if (!normalizePhone(to)) return NextResponse.json({ error: "Escribe un celular válido" }, { status: 400 });
  const rl = rateLimit(`quot-wa:${r.user.id}`, 40, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados envíos, intenta más tarde" }, { status: 429 });
  // Si el documento no tenía celular, se guarda el que se usó
  if (!r.q.clientPhone) await prisma.quotation.update({ where: { id: r.q.id }, data: { clientPhone: to } }).catch(() => {});
  const message = await buildMessage(request, r.q);
  const res = await sendWhatsApp(to, message);
  return NextResponse.json({ sent: res.ok, error: res.ok ? undefined : res.error, message, phone: to });
}

import type { Repair } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, canAccessBranch, unauthorized, notFound, forbidden } from "@/backend/auth";
import { publicBaseUrl } from "@/backend/public-url";
import { deliveryReceipt } from "@/backend/receipt";
import { sendWhatsAppSafe } from "@/backend/whatsapp";
import { rateLimit } from "@/backend/rate-limit";
import { isEmail, mailLayout, sendMail } from "@/backend/mail";
import { fmtDateLong } from "@/backend/receipt";

// Comprobante de entrega digital (personal del taller):
//   GET  ?code=OT-2  → enlace personal y mensaje listo (para copiar o abrir WhatsApp)
//   POST {code}      → lo envía por WhatsApp desde el número del taller
async function findRepair(request: Request, code: string) {
  const user = await getUserFromToken(request);
  if (!user) return { error: unauthorized() };
  const branchId = getEffectiveBranchId(request, user);
  const repair = await prisma.repair.findFirst({ where: { code, ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: "desc" } });
  if (!repair) return { error: notFound("Orden no encontrada") };
  if (!canAccessBranch(user, repair.branchId)) return { error: forbidden() };
  if (user.role === "tech" && repair.technicianId !== user.id) return { error: forbidden() };
  if (repair.status !== "delivered") return { error: NextResponse.json({ error: "La orden todavía no fue entregada" }, { status: 400 }) };
  return { user, repair };
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  const r = await findRepair(request, code);
  if ("error" in r) return r.error;
  const receipt = await deliveryReceipt(r.repair, publicBaseUrl(request));
  return NextResponse.json({ ...receipt, phone: r.repair.clientPhone, clientName: r.repair.clientName, email: r.repair.clientEmail });
}

export async function POST(request: Request) {
  const { code, email } = await request.json().catch(() => ({ code: "", email: "" }));
  const r = await findRepair(request, String(code || ""));
  if ("error" in r) return r.error;
  if (typeof email === "string" && email.trim()) return sendByEmail(request, r.user.id, r.repair, email.trim());
  if (!r.repair.clientPhone) return NextResponse.json({ error: "La orden no tiene celular del cliente" }, { status: 400 });
  const rl = rateLimit(`receipt:${r.user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados envíos, intenta más tarde" }, { status: 429 });
  const receipt = await deliveryReceipt(r.repair, publicBaseUrl(request));
  const sent = await sendWhatsAppSafe(r.repair.clientPhone, receipt.message);
  return NextResponse.json({ sent, ...receipt, phone: r.repair.clientPhone });
}

/** Comprobante por correo: guarda el correo en la orden para la próxima vez. */
async function sendByEmail(request: Request, userId: string, repair: Repair, email: string) {
  if (!isEmail(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  const rl = rateLimit(`receipt-mail:${userId}`, 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados envíos, intenta más tarde" }, { status: 429 });
  const receipt = await deliveryReceipt(repair, publicBaseUrl(request));
  const device = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
  const total = Number(repair.estimatedCost || 0);
  const rows: [string, string][] = [["Orden", repair.code], ["Equipo", device]];
  if (total > 0) rows.push(["Total", `Bs. ${total}`]);
  if (receipt.warrantyUntil) rows.push(["Garantía hasta", fmtDateLong(new Date(receipt.warrantyUntil))]);
  const first = repair.clientName?.split(" ")[0];
  const html = await mailLayout({
    title: `Comprobante de entrega ${receipt.ceCode}`,
    intro: `Hola${first ? ` <b>${first.replace(/[<>&]/g, "")}</b>` : ""}, gracias por confiar en nosotros. Aquí está el comprobante de entrega de tu equipo.`,
    rows, button: { text: "Ver comprobante completo", url: receipt.url },
    footerNote: "Recibiste este correo porque dejaste tu equipo en nuestro taller.",
  });
  const r = await sendMail(email, `Comprobante de entrega ${receipt.ceCode} · ${device}`, html);
  if (r.ok && repair.clientEmail !== email) await prisma.repair.update({ where: { id: repair.id }, data: { clientEmail: email } }).catch(() => {});
  return NextResponse.json({ sent: r.ok, error: r.error, channel: "email", email, ceCode: receipt.ceCode }, { status: r.ok ? 200 : 502 });
}

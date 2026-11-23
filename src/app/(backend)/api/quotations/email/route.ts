import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, canAccessBranch, unauthorized, forbidden, notFound } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { companyInfo } from "@/backend/company";
import { publicBaseUrl } from "@/backend/public-url";
import { fmtDateLong } from "@/backend/receipt";
import { escapeHtml, isEmail, mailLayout, sendMail } from "@/backend/mail";

interface Item { name?: string; qty?: number; price?: number }

/** Cotización o nota de venta por correo: { id, email } */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  if (user.role === "tech") return forbidden("Solo administradores");
  const { id, email } = await request.json().catch(() => ({}));
  if (!isEmail(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  const rl = rateLimit(`quot-mail:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Demasiados envíos, intenta más tarde" }, { status: 429 });

  const q = await prisma.quotation.findUnique({ where: { id: String(id || "") } });
  if (!q) return notFound("Documento no encontrado");
  if (!canAccessBranch(user, q.branchId)) return forbidden();

  const isQuot = q.type === "quotation";
  const label = isQuot ? "Cotización" : "Nota de venta";
  let items: Item[] = [];
  try { items = JSON.parse(q.items); } catch {}
  const rows: [string, string][] = items.slice(0, 10).map((i) => [`${i.qty && i.qty > 1 ? `${i.qty} × ` : ""}${i.name || "Ítem"}`, `Bs. ${Math.round((i.price || 0) * (i.qty || 1))}`]);
  if (items.length > 10) rows.push([`… y ${items.length - 10} ítems más`, ""]);
  rows.push(["Total", `Bs. ${Math.round(q.total || 0).toLocaleString("es-BO")}`]);
  if (isQuot) rows.push(["Válida hasta", fmtDateLong(new Date(q.createdAt.getTime() + 15 * 86_400_000))]);

  const company = await companyInfo(publicBaseUrl(request));
  const base = company.portalUrl.replace(/\/portal$/, "");
  const url = `${base}/quotations/print/${encodeURIComponent(q.code)}?branchId=${encodeURIComponent(q.branchId)}`;
  const first = q.clientName?.split(" ")[0];
  const html = await mailLayout({
    title: `${label} ${q.code}`,
    intro: `Hola${first ? ` <b>${escapeHtml(first)}</b>` : ""}, ${isQuot ? "te enviamos la cotización que solicitaste." : "gracias por tu compra. Aquí está tu nota de venta."}`,
    rows,
    button: { text: `Ver ${label.toLowerCase()} completa`, url },
    footerNote: isQuot ? "Cualquier consulta, responde a este correo o escríbenos por WhatsApp." : "Guarda este correo como respaldo de tu compra.",
  });
  const r = await sendMail(email.trim(), `${label} ${q.code} · ${company.companyName}`, html);
  return NextResponse.json({ sent: r.ok, error: r.error }, { status: r.ok ? 200 : 502 });
}

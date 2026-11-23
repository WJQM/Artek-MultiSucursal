// Documento público (cotización / nota de venta). La vista es un componente de cliente (view.tsx);
// aquí solo se arma el título y el logo para la vista previa al compartir el enlace.
import type { Metadata } from "next";
import { prisma } from "@/backend/prisma";
import { getSettings, DEFAULT_COMPANY_NAME } from "@/backend/company";
import { shareMetadata } from "@/backend/share-metadata";
import View from "./view";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ branchId?: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { branchId } = await searchParams;
  const code = decodeURIComponent(id || "");
  const s = await getSettings();
  const company = s?.companyName?.trim() || DEFAULT_COMPANY_NAME;
  const q = await prisma.quotation.findFirst({ where: { code, ...(branchId ? { branchId } : {}) }, select: { type: true, total: true } }).catch(() => null);
  const label = q?.type === "sale" || /^NV/i.test(code) ? "Nota de venta" : "Cotización";
  const title = `${label} ${code} · ${company}`;
  const description = q ? `Total: Bs. ${Math.round(q.total || 0).toLocaleString("es-BO")}${s?.slogan ? ` · ${s.slogan}` : ""}` : s?.slogan || company;
  return { ...(await shareMetadata({ title, description })), title };
}

export default function Page() {
  return <View />;
}

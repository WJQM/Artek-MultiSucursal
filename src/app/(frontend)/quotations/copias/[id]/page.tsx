"use client";
import { Banknote, ClipboardList, Disc3, FileText, Gamepad2, Joystick, Laptop, Package, PenLine, Printer, Receipt, ShoppingCart, User, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { AppIcon } from "@/frontend/components/icons";
import { closePage } from "@/frontend/lib/close-page";
/**
 * Cotización (COT) / Nota de venta (NV) en DOBLE COPIA: copia negocio + copia cliente
 * lado a lado en hoja carta horizontal, igual que la recepción (OT) y el comprobante (CE).
 * El QR abre la hoja completa (/quotations/print/CODE).
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicBase } from "@/frontend/lib/public-base";
import { DocPrint, DocBar, DocHead, DocTitle, DocQr, DocBox, DocRow, DocCopies, DocSign, qrSrc, bs } from "@/frontend/components/DocKit";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface QuotationItem { name: string; price: number; qty: number; kind?: string; isEquipment?: boolean }
interface Quotation { id: string; code: string; type: "quotation" | "sale"; clientName: string; clientPhone: string; items: QuotationItem[]; total: number; notes: string; createdAt: string; paidWith?: string | null }
interface Settings { companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null }

const KIND_IC: Record<string, AppIcon> = { equipment: Laptop, console: Joystick, service: Wrench, software: Disc3, videogame: Gamepad2, custom: PenLine, inventory: Package };
function KindIcon({ kind }: { kind: string }) { const I = KIND_IC[kind] || Package; return <I size={13} strokeWidth={STROKE} aria-hidden="true" />; }

const PAID: Record<string, string> = { cash: "Efectivo", qr: "QR" };

export default function QuotationCopiesPage() {
  const params = useParams();
  const code = params.id as string;
  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [settings, setSettings] = useState<Settings>({ companyName: "", slogan: "", logo: null, phone: null, email: null, address: null });

  useEffect(() => {
    publicBase().then(setBaseUrl);
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setSettings(d); }).catch(() => {});
    if (!code) return;
    const bp = new URLSearchParams(window.location.search).get("branchId") || "";
    fetch(`/api/quotations?code=${code}${bp ? `&branchId=${bp}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.multiple) setQ(d.quotations[0]); else if (d) setQ(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [code]);

  if (loading) return <DocSkeleton />;
  if (!q) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Documento no encontrado: {code}</div>;

  const branchParam = new URLSearchParams(window.location.search).get("branchId") || "";
  const isQuot = q.type === "quotation";
  const created = new Date(q.createdAt);
  const createdText = created.toLocaleDateString("es-BO", { hourCycle: "h23", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const validUntil = new Date(created.getTime() + 15 * 86_400_000).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
  const qrUrl = baseUrl ? `${baseUrl}/quotations/print/${q.code}${branchParam ? `?branchId=${branchParam}` : ""}` : "";
  const totalQty = q.items.reduce((s, i) => s + i.qty, 0);
  const paid = q.paidWith ? PAID[q.paidWith] : null;

  const copy = (label: string) => (
    <>
      <DocHead s={settings} icon={isQuot ? <ClipboardList size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} label={isQuot ? "Cotización" : "Nota de venta"} code={q.code} />
      <DocTitle tags={[...(isQuot ? [{ text: `Válida hasta ${validUntil}`, warn: true }] : paid ? [{ text: `Pagado · ${paid}` }] : []), { text: label }]}>{isQuot ? "Cotización" : "Nota de venta"}</DocTitle>
      <div className="dk-grid3">
        <DocQr src={qrSrc(qrUrl)} caption={<>Escanea para ver<br />este documento en línea</>} />
        <DocBox icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
          <DocRow label="Nombre" value={q.clientName || "—"} />
          <DocRow label="Celular" value={q.clientPhone || "—"} />
          <DocRow label="Fecha" value={createdText} />
        </DocBox>
        <DocBox icon={<Receipt size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Resumen">
          <DocRow label="Artículos" value={`${q.items.length} (${totalQty} u.)`} />
          {paid && <DocRow label="Pagó con" value={paid} />}
          <div className="dk-cost"><span>{isQuot ? "Total" : "Total pagado"}</span><b className="tabular">{bs(q.total)}</b></div>
        </DocBox>
      </div>
      <DocBox icon={<ShoppingCart size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Detalle">
        <table className="dk-table">
          <thead><tr><th>Concepto</th><th className="n">Cant.</th><th className="n">Precio</th><th className="n">Subtotal</th></tr></thead>
          <tbody>
            {q.items.map((it, i) => {
              const kind = it.kind || (it.isEquipment ? "equipment" : "inventory");
              return (
                <tr key={i}>
                  <td><KindIcon kind={kind} /> {it.name}</td>
                  <td className="n">{it.qty}</td>
                  <td className="n tabular">{bs(it.price)}</td>
                  <td className="n tabular"><b>{bs((it.price || 0) * it.qty)}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="dk-cost"><span>{isQuot ? "Total" : "Total pagado"}</span><b className="tabular">{bs(q.total)}</b></div>
      </DocBox>
      {q.notes && <div className="dk-block warn"><small>Notas</small>{q.notes}</div>}
      <div className={`dk-terms${isQuot ? "" : " ok"}`}>
        <b className="t">{isQuot ? "Condiciones" : "Conformidad"}</b>
        {isQuot
          ? <>1. Válida por <strong>15 días</strong> (hasta el {validUntil}). 2. Precios sujetos a disponibilidad. 3. No incluye instalación salvo indicación. 4. Presente este documento o el código <strong>{q.code}</strong>.</>
          : <>Se confirma la venta a <strong>{q.clientName || "el cliente"}</strong> por <strong>{bs(q.total)}</strong>. Garantía según la política de cada producto. Cambios solo con esta nota.</>}
      </div>
      <DocSign left="Firma del cliente" right={isQuot ? "Atendido por" : "Vendido por"} />
    </>
  );

  return (
    <div className={`dk${isQuot ? "" : " dk-green"}`}>
      <DocPrint landscape />
      <DocBar title={<>{isQuot ? "Cotización" : "Nota de venta"} x2 — {q.code}</>}>
        <button onClick={() => { window.location.href = `/quotations/print/${q.code}${branchParam ? `?branchId=${branchParam}` : ""}`; }}><FileText size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Hoja completa</span></button>
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>
      <DocCopies render={copy} />
    </div>
  );
}

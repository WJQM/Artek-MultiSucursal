"use client";
import { Banknote, CircleCheck, ClipboardList, Copy, Disc3, Download, Gamepad2, Hourglass, Joystick, Laptop, Package, PenLine, Printer, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { AppIcon } from "@/frontend/components/icons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalTracker } from "@/frontend/components/PortalTracker";
import { publicBase } from "@/frontend/lib/public-base";
import { DocPrint, DocBar, DocHero, qrSrc, bs } from "@/frontend/components/DocKit";
import { waLink } from "@/frontend/components/PortalWhatsApp";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface QuotationItem { inventoryId: string; name: string; price: number; qty: number; stock: number; kind?: string; isEquipment?: boolean }
interface Quotation { id: string; code: string; type: "quotation" | "sale"; clientName: string; clientPhone: string; items: QuotationItem[]; total: number; notes: string; createdAt: string; paidWith?: string | null }

const KIND_IC: Record<string, AppIcon> = { equipment: Laptop, console: Joystick, service: Wrench, software: Disc3, videogame: Gamepad2, custom: PenLine, inventory: Package };
function KindIcon({ kind }: { kind: string }) { const I = KIND_IC[kind] || Package; return <I size={13} strokeWidth={STROKE} aria-hidden="true" />; }

const KIND_TAG: Record<string, [string, string, string]> = {
  equipment: ["Equipo", "#dbeafe", "#1d4ed8"], console: ["Consola", "#ffedd5", "#c2410c"], service: ["Servicio", "#ccfbf1", "#0f766e"],
  software: ["Programa", "#e0f2fe", "#0369a1"], videogame: ["Videojuego", "#fef2f2", "#b91c1c"], inventory: ["Producto", "#fffbeb", "#b45309"],
};
const PAID: Record<string, string> = { cash: "Efectivo", qr: "QR" };

export default function QuotationPrintPage() {
  const params = useParams();
  const code = params.id as string;
  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  // Hora de apertura de la página (para los días de validez que quedan)
  const [nowMs] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);
  const [payQr, setPayQr] = useState<{ image: string; bank: string; holder: string; onDocuments: boolean } | null>(null);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null; website: string | null; city?: string | null }>({ companyName: "", slogan: "", logo: null, phone: null, email: null, address: null, website: null });

  useEffect(() => {
    publicBase().then(setBaseUrl);
    fetch("/api/payments").then(r => r.ok ? r.json() : null).then(d => { if (d?.onDocuments && d.image) setPayQr(d); }).catch(() => {});
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
    if (!code) return;
    const branchId = new URLSearchParams(window.location.search).get("branchId");
    const url = branchId ? `/api/quotations?code=${code}&branchId=${branchId}` : `/api/quotations?code=${code}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.multiple) setQ(d.quotations[0]); else if (d) setQ(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [code]);

  if (loading) return <DocSkeleton />;
  if (!q) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Documento no encontrado: {code}</div>;

  const isQuot = q.type === "quotation";
  // La doble copia es para el personal (el cliente que escanea el QR solo ve esta hoja)
  const isStaff = (() => { try { return !!sessionStorage.getItem("token"); } catch { return false; } })();
  // COTIZACIÓN = azul oscuro con etiqueta ámbar | NOTA DE VENTA = verde con sello "PAGADO"
  const head = isQuot ? "#1e2a3a" : "#047857";
  const docTitle = isQuot ? "Cotización" : "Nota de venta";
  const docIcon = isQuot ? <ClipboardList size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />;
  const qrBranch = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("branchId") : null;
  const qrUrl = baseUrl ? `${baseUrl}/quotations/print/${q.code}${qrBranch ? `?branchId=${qrBranch}` : ""}` : "";
  const qrImg = qrSrc(qrUrl, 200);
  const total = q.total;
  const totalQty = q.items.reduce((s, i) => s + i.qty, 0);
  const subtotal = q.items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const discount = Math.max(0, Math.round(subtotal - total));
  // Cotización: vale 15 días desde que se emitió
  const created = new Date(q.createdAt);
  const untilDate = new Date(created.getTime() + 15 * 86_400_000);
  const validUntil = untilDate.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
  const validLeft = Math.ceil((untilDate.getTime() - nowMs) / 86_400_000);
  // Cotización vencida: ya no se ofrece pagar con QR (los precios pueden haber cambiado)
  const expired = isQuot && validLeft <= 0;
  const renewWa = expired ? waLink(settings.phone, `Hola, quisiera una cotización actualizada de la ${q.code}.`) : null;
  const lines = q.items.length;
  const countLabel = `${lines} ${lines === 1 ? "producto" : "productos"}${totalQty !== lines ? ` · ${totalQty} unidades` : ""}`;
  const issued = created.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
  const issuedTime = created.toLocaleString("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(/\./g, "");
  const paid = q.paidWith ? PAID[q.paidWith] : null;
  const kindOf = (item: QuotationItem) => item.kind || (item.isEquipment ? "equipment" : "inventory");

  return (
    <div className={`dk${isQuot ? "" : " dk-green"}`}>
      <PortalTracker />
      <DocPrint />
      <DocBar title={<>{docIcon} <span className="doc-long">{isQuot ? "Cotización" : "Nota de venta"} — </span>{q.code}</>}>
        {isStaff && <button onClick={() => { window.location.href = `/quotations/copias/${q.code}${qrBranch ? `?branchId=${qrBranch}` : ""}`; }}><Copy size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Doble copia</span></button>}
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>

      <div className="dk-page print-content doc-full">
        <DocHero s={settings} icon={docIcon} label={docTitle} code={q.code} />

        {/* ═══ CELULAR: recibo digital (total arriba, todo en una pantalla) ═══ */}
        <div className="doc-phone-only" style={{ marginTop: 14 }}>
          <div style={{ background: head, color: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--border-strong)" }}>Total</div>
            <div className="tabular" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{bs(total)}</div>
            <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 10px", marginTop: 10, fontSize: 13 }}>
              {isQuot
                ? (validLeft > 0 ? <><Hourglass size={14} strokeWidth={STROKE} aria-hidden="true" /> Válida hasta el <b>{validUntil}</b> · {validLeft === 1 ? "queda 1 día" : `quedan ${validLeft} días`}</> : <>⌛ Venció el <b>{validUntil}</b> · consulta precios actualizados</>)
                : <><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Venta confirmada · {issuedTime}{paid ? <> · {paid}</> : null}</>}
            </div>
          </div>
          {expired && (
            <div className="dk-block warn no-print" style={{ marginTop: 12, fontSize: 13 }}>
              <small>⌛ Cotización vencida</small>
              Los precios pueden haber cambiado. Pide una cotización actualizada.
              {renewWa && <a href={renewWa} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 10, padding: "11px 14px", background: "#25D366", borderRadius: 10, color: "#fff", fontWeight: 700, textAlign: "center", textDecoration: "none" }}>Pedir por WhatsApp</a>}
            </div>
          )}
          {payQr && isQuot && !expired && (
            <div className="dk-pay" style={{ marginTop: 12 }}>
              { }
              <img src={payQr.image} alt="QR de pago" />
              <div><b style={{ fontSize: 14 }}>Paga con QR</b><br />Escanea con la app de tu banco y escribe <b>{bs(total)}</b>{payQr.bank ? <><br />{[payQr.bank, payQr.holder].filter(Boolean).join(" · ")}</> : null}</div>
            </div>
          )}
          <div className="dk-meta" style={{ margin: "12px 0" }}>
            <div><small>Cliente</small><b>{q.clientName || "—"}</b>{q.clientPhone && <p>{q.clientPhone}</p>}</div>
          </div>
          <div className="dk-card">
            <h3>Detalle · {countLabel}</h3>
            <div className="in">
              {q.items.map((item, idx) => (
                <div key={idx} className="dk-line">
                  <span><KindIcon kind={kindOf(item)} /> {item.name}<br /><small style={{ color: "var(--text-muted)" }}>{item.qty} × {bs(item.price)}</small></span>
                  <b className="tabular">{bs(item.price * item.qty)}</b>
                </div>
              ))}
              <div className="dk-line" style={{ border: 0, fontWeight: 700 }}><span>Total</span><b className="tabular">{bs(total)}</b></div>
            </div>
          </div>
          {q.notes && <div className="dk-block warn" style={{ fontSize: 13 }}><small>Notas</small>{q.notes}</div>}
          {showQr && qrImg && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              { }
              <img src={qrImg} alt="QR" width={170} height={170} style={{ display: "inline-block", border: `2px solid ${head}`, borderRadius: 12, padding: 8 }} />
            </div>
          )}
          <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => window.print()} style={{ flex: 1, height: 48, background: "var(--warn-bright)", border: "none", borderRadius: 12, color: "#422006", fontSize: 15, fontWeight: 700, cursor: "pointer" }}><Download size={14} strokeWidth={STROKE} aria-hidden="true" /> Guardar PDF</button>
            {qrImg && <button onClick={() => setShowQr((v) => !v)} style={{ padding: "0 16px", height: 48, background: "#fff", border: "1px solid #d6dce8", borderRadius: 12, color: "var(--text-secondary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{showQr ? "Ocultar QR" : "Ver QR"}</button>}
          </div>
        </div>

        {/* ═══ HOJA (computadora e impresión) ═══ */}
        <div className="doc-desk-only">
          <div className="dk-meta">
            <div><small>Cliente</small><b>{q.clientName || "—"}</b>{q.clientPhone && <p>{q.clientPhone}</p>}</div>
            <div><small>Fecha</small><b>{issued}</b></div>
            {isQuot
              ? <div><small><Hourglass size={14} strokeWidth={STROKE} aria-hidden="true" /> Válida hasta</small><b>{validUntil}</b>{validLeft <= 0 && <p>Vencida · consulta precios</p>}</div>
              : <div><small>Pagado con</small><b>{paid || "—"}</b></div>}
          </div>

          <div style={{ position: "relative" }}>
            <table className="dk-ftable">
              <thead><tr><th>Concepto</th><th className="n">Cant.</th><th className="n">Precio</th><th className="n">Subtotal</th></tr></thead>
              <tbody>
                {q.items.map((item, idx) => {
                  const kind = kindOf(item);
                  const tag = KIND_TAG[kind];
                  return (
                    <tr key={idx}>
                      <td><KindIcon kind={kind} /> {item.name}{tag && <span className="dk-tag" style={{ background: tag[1], color: tag[2] }}>{tag[0]}</span>}</td>
                      <td className="n">{item.qty}</td>
                      <td className="n tabular">{bs(item.price)}</td>
                      <td className="n tabular"><b>{bs(item.price * item.qty)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="dk-tot"><div>
              {discount > 0 && <><p><span>Subtotal</span><b className="tabular">{bs(subtotal)}</b></p><p className="minus"><span>Descuento</span><b className="tabular">− {bs(discount)}</b></p></>}
              <p className="big"><span>{isQuot ? "Total" : "Total pagado"}</span><b className="tabular">{bs(total)}</b></p>
            </div></div>
            {!isQuot && <div className="dk-stamp" style={{ left: 40, bottom: 12 }}>PAGADO</div>}
          </div>

          <div className="dk-bottom">
            <div className="dk-terms" style={{ fontSize: 11.5, padding: "10px 12px" }}>
              <b className="t">{q.notes ? "Notas y condiciones" : "Condiciones"}</b>
              {q.notes && <p style={{ marginBottom: 6 }}>{q.notes}</p>}
              {isQuot
                ? <>Válida por 15 días. Precios sujetos a disponibilidad. No incluye instalación salvo indicación. Presenta este documento o el código <strong>{q.code}</strong>.</>
                : <>Venta confirmada a <strong>{q.clientName || "el cliente"}</strong> por <strong>{bs(total)}</strong>. Garantía según la política de cada producto. Cambios solo con esta nota.</>}
            </div>
            {isQuot && payQr && !expired ? (
              <div className="dk-pay">
                { }
                <img src={payQr.image} alt="QR de pago" />
                <div><b>Paga con QR</b><br />Escanea con la app de tu banco{payQr.bank ? <><br />{payQr.bank}</> : null}{payQr.holder ? <><br />{payQr.holder}</> : null}</div>
              </div>
            ) : qrImg ? (
              <div className="dk-pay">
                { }
                <img src={qrImg} alt="QR del documento" />
                <div><b>{isQuot ? "Ver en línea" : "Verifica esta venta"}</b><br />Escanea para ver este documento desde tu celular.</div>
              </div>
            ) : <span />}
          </div>

          <div className="dk-foot"><span>{settings.companyName}{settings.city ? ` · ${settings.city}` : ""}</span><span>{isQuot ? "Gracias por tu preferencia " : "Gracias por tu compra "}</span></div>
        </div>
      </div>
    </div>
  );
}

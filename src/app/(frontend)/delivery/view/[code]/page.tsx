"use client";
import { Backpack, Banknote, CircleCheck, Copy, Download, FileText, Printer, Tag, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { DocTabs, useSwipeTabs, type DocTab } from "@/frontend/components/DocTabs";
import { ClientVerify } from "@/frontend/components/ClientVerify";
import { trackUrl, trackHeaders, passFromLink } from "@/frontend/lib/track-client";
import { publicBase } from "@/frontend/lib/public-base";
import { useParams } from "next/navigation";
import { DocPrint, DocBar, DocHero, DocCard, qrSrc, bs } from "@/frontend/components/DocKit";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface Repair {
  /** Sin sesión ni verificación: solo datos enmascarados y opción de verificar el celular */
  protected?: boolean; canVerify?: boolean;
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; estimatedCost: number; notes: string | null;
  image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string; deliveredAt?: string | null;
}

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseNotesAll(n: string | null): { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[]; deliveryNotes: string; discount: string } {
  if (!n) return { notes: "", services: [], software: [], videogames: [], repuestos: [], deliveryNotes: "", discount: "" };
  const parts = n.split(" | ");
  const svc = parts.find(p => p.startsWith("Servicios: ")); const sw = parts.find(p => p.startsWith("Programas: ") || p.startsWith("Software: ")); const vg = parts.find(p => p.startsWith("Videojuegos: ")); const rep = parts.find(p => p.startsWith("Repuestos: ")); const del = parts.find(p => p.startsWith("Entrega: ")); const disc = parts.find(p => p.startsWith("Descuento: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Programas: ") && !p.startsWith("Software: ") && !p.startsWith("Videojuegos: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: ") && !p.startsWith("Descuento: "));
  return { notes: rest.join(" | "), services: svc ? svc.replace("Servicios: ", "").split(", ").filter(Boolean) : [], software: sw ? sw.replace("Programas: ", "").replace("Software: ", "").split(", ").filter(Boolean) : [], videogames: vg ? vg.replace("Videojuegos: ", "").split(", ").filter(Boolean) : [], repuestos: rep ? rep.replace("Repuestos: ", "").split(", ").filter(Boolean) : [], deliveryNotes: del ? del.replace("Entrega: ", "") : "", discount: disc ? disc.replace("Descuento: ", "") : "" };
}
function otToCe(otCode: string): string { return `CE-${otCode.replace(/^OT-/i, "")}`; }

const CE_TABS: DocTab[] = [{ id: "resumen", label: "Resumen" }, { id: "equipo", label: "Equipo" }, { id: "costos", label: "Costos" }, { id: "condiciones", label: "Condiciones" }];

export default function DeliveryFullPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  // Hora de apertura de la página (para los días de garantía que quedan)
  const [nowMs] = useState(() => Date.now());
  const [servicesList, setServicesList] = useState<{name: string; price: number}[]>([]);
  const [inventoryList, setInventoryList] = useState<{name: string; price: number}[]>([]);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null; website: string | null; city?: string | null; warrantyDays?: number; abandonDays?: number; terms?: string | null }>({ companyName: "", slogan: "", logo: null, phone: null, email: null, address: null, website: null });
  const [branchParam, setBranchParam] = useState("");
  const [tab, setTab] = useState("resumen");
  const swipe = useSwipeTabs(CE_TABS, tab, setTab);

  useEffect(() => { publicBase().then(setBaseUrl); const bp = new URLSearchParams(window.location.search).get("branchId") || ""; setBranchParam(bp); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
  useEffect(() => {
    if (code) {
      passFromLink(code).then(() => { const bp = new URLSearchParams(window.location.search).get("branchId"); return fetch(trackUrl(code, bp), { cache: "no-store", headers: trackHeaders(code) }); }).then(r => r.ok ? r.json() : null).then(d => { if (d && d.multiple) setRepair(d.repairs[0]); else if (d) setRepair(d); setLoading(false); }).catch(() => setLoading(false));
      fetch("/api/services").then(r => r.ok ? r.json() : []).then(d => setServicesList(d)).catch(() => {});
      fetch("/api/inventory").then(r => r.ok ? r.json() : []).then(d => setInventoryList(d)).catch(() => {});
    }
  }, [code]);

  if (loading) return <DocSkeleton />;
  if (!repair) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Orden no encontrada: {code}</div>;
  // Documento personal del cliente: sin sesión se pide confirmar los últimos 4 dígitos del celular
  if (repair.protected) {
    const r = repair;
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6b7a9a", fontWeight: 700 }}>{settings.companyName}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}><FileText size={20} strokeWidth={STROKE} aria-hidden="true" /> Comprobante de entrega <span style={{ whiteSpace: "nowrap" }}>{code.replace(/^OT-/i, "CE-")}</span></div>
          </div>
          <ClientVerify code={r.code} repairId={r.id} maskedPhone={r.clientPhone} canVerify={r.canVerify} purpose="ver y descargar tu comprobante"
            onVerified={(token) => {
              const bp = new URLSearchParams(window.location.search).get("branchId");
              fetch(trackUrl(code, bp), { cache: "no-store", headers: { "x-track-token": token } }).then(x => x.ok ? x.json() : null).then(d => { if (d && !d.multiple) setRepair(d); }).catch(() => {});
            }} />
        </div>
      </div>
    );
  }

  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
  const deliveredDate = new Date(repair.deliveredAt || repair.updatedAt).toLocaleDateString("es-BO", { hourCycle: "h23", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const warranty = (() => {
    const days = settings.warrantyDays ?? 30;
    const from = repair.deliveredAt || repair.updatedAt;
    if (!days || !from) return null;
    const until = new Date(new Date(from).getTime() + days * 86_400_000);
    return { until: until.toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, ""), left: Math.ceil((until.getTime() - nowMs) / 86_400_000) };
  })();
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const parsed = parseNotesAll(repair.notes);
  const ceCode = otToCe(repair.code);
  const qrUrl = `${baseUrl}/delivery/view/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}`;
  const qrImg = baseUrl ? qrSrc(qrUrl, 400) : "";
  const deviceName = [repair.brand, repair.model || repair.device].filter(Boolean).join(" ");
  // Informe final publicado para el cliente (bitácora técnica)
  const reportList = (repair as { report?: unknown }).report;
  type ReportItem = { id: string; type: string; text: string; images: string[]; authorName: string; createdAt: string };
  const finalReport: ReportItem[] = Array.isArray(reportList) ? (reportList as ReportItem[]).filter((e) => e.type === "final") : [];

  // La doble copia es para imprimir en el negocio: el cliente que abre el QR no la ve
  const isStaff = (() => { try { return !!sessionStorage.getItem("token"); } catch { return false; } })();

  const discount = Number(parsed.discount || 0);
  const lines: [string, string, number | null][] = [
    ...parsed.services.map((name): [string, string, number | null] => ["", name, servicesList.find((x) => x.name === name)?.price ?? null]),
    ...parsed.repuestos.map((name): [string, string, number | null] => ["", name, inventoryList.find((x) => x.name === name)?.price ?? null]),
  ];

  return (
    <div className="dk dk-green">
      <DocPrint />
      <DocBar title={<><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> <span className="doc-long">Comprobante de entrega — </span>{ceCode}</>}>
        {isStaff && <button onClick={() => window.open(`/delivery/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}`, "_blank")}><Copy size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Doble copia</span></button>}
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>

      <div className="dk-page print-content doc-full" data-tab={tab} {...swipe}>
        <DocHero s={settings} icon={<CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" />} label="Comprobante de entrega" code={ceCode} sub={`Orden ${repair.code}`} />

        <div style={{ marginTop: 14 }}><DocTabs tabs={CE_TABS} active={tab} onChange={setTab} color="#047857" /></div>

        {/* ═══ RECIBO DIGITAL (solo celular): lo esencial para el cliente ═══ */}
        <div className="doc-phone-only" data-tab="resumen" style={{ background: "var(--ok)", color: "#fff", borderRadius: 16, padding: "18px 16px", textAlign: "center", margin: "14px 0" }}>
          <div style={{ fontSize: 30, lineHeight: 1 }}><CircleCheck size={30} strokeWidth={STROKE} aria-hidden="true" /></div>
          <div style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>Equipo entregado</div>
          <div style={{ fontSize: 13, color: "var(--ok-line)", marginTop: 2 }}>{deliveredDate}</div>
          {warranty && (
            <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 10px", marginTop: 12, fontSize: 13 }}>
              {warranty.left > 0 ? <>Garantía hasta el <b>{warranty.until}</b> · {warranty.left === 1 ? "queda 1 día" : `quedan ${warranty.left} días`}</> : <>La garantía venció el <b>{warranty.until}</b></>}
            </div>
          )}
          <div className="tabular" style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>{bs(repair.estimatedCost)}</div>
          <div style={{ fontSize: 12, color: "var(--ok-line)" }}>Total cobrado</div>
          <button className="no-print" onClick={() => window.print()} style={{ marginTop: 12, width: "100%", height: 46, background: "var(--warn-bright)", border: "none", borderRadius: 12, color: "#422006", fontSize: 15, fontWeight: 700, cursor: "pointer" }}><Download size={14} strokeWidth={STROKE} aria-hidden="true" /> Guardar PDF</button>
        </div>

        {/* ═══ DATOS ═══ */}
        <div className="dk-meta" data-tab="resumen">
          <div><small>Cliente</small><b>{repair.clientName || "—"}</b>{repair.clientPhone && <p>{repair.clientPhone}</p>}</div>
          <div><small>Equipo entregado</small><b>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</b><p>Recibido el {createdDate}</p></div>
          <div><small>Entregado</small><b>{deliveredDate}</b>{warranty && <p>Garantía hasta {warranty.until}</p>}</div>
        </div>

        <div className="doc-desk-only" style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 16, marginBottom: 16, alignItems: "start" }} data-tab="resumen">
          <div className="dk-qr" style={{ padding: 10 }}>
            { }
            {qrImg ? <img src={qrImg} alt="Código QR" /> : <div className="ph" />}
            <small>Escanea para ver este<br />comprobante y tu garantía</small>
          </div>
          <DocCard icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios devueltos" ok>
            {checkedAcc.length > 0
              ? <div className="dk-acc">{checkedAcc.map((a) => { const { name, detail } = parseAccWithDetail(a); return <div key={a}>{name}{detail && <i> ({detail})</i>}</div>; })}</div>
              : <span className="dk-empty">Sin accesorios registrados</span>}
            {parsed.deliveryNotes && <div className="dk-block warn" style={{ marginTop: 8 }}><small>Nota de la entrega</small>{parsed.deliveryNotes}</div>}
          </DocCard>
        </div>
        <div className="doc-phone-only" data-tab="equipo">
          <DocCard icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios devueltos" ok>
            {checkedAcc.length > 0
              ? <div className="dk-acc">{checkedAcc.map((a) => { const { name, detail } = parseAccWithDetail(a); return <div key={a}>{name}{detail && <i> ({detail})</i>}</div>; })}</div>
              : <span className="dk-empty">Sin accesorios registrados</span>}
          </DocCard>
        </div>

        {/* ═══ INFORME TÉCNICO (informe final publicado para el cliente) ═══ */}
        {finalReport.length > 0 && (
          <div data-tab="equipo">
            <DocCard icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Informe del técnico">
              {finalReport.map((e) => (
                <div key={e.id} style={{ marginBottom: 10 }}>
                  {e.text !== "(solo fotos)" && <p style={{ whiteSpace: "pre-wrap" }}>{e.text}</p>}
                  {e.images?.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      { }
                      {e.images.map((src) => <img key={src} src={src} alt="Foto del informe" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border-soft)" }} />)}
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}><Wrench size={14} strokeWidth={STROKE} aria-hidden="true" /> {e.authorName} · {new Date(e.createdAt).toLocaleDateString("es-BO")}</p>
                </div>
              ))}
            </DocCard>
          </div>
        )}

        {/* ═══ COBRO ═══ */}
        <div data-tab="costos">
          <DocCard icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Detalle del cobro">
            {lines.map(([icon, name, price]) => <div key={icon + name} className="dk-line"><span>{icon} {name}</span><b className="tabular">{price != null ? bs(price) : "—"}</b></div>)}
            {discount > 0 && <><div className="dk-line"><span>Subtotal</span><b className="tabular">{bs(Number(repair.estimatedCost) + discount)}</b></div><div className="dk-line minus"><span><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Descuento</span><b className="tabular">− {bs(discount)}</b></div></>}
            <div className="dk-tot" style={{ margin: "10px 0 0" }}><div><p className="big"><span>Total cobrado</span><b className="tabular">{bs(repair.estimatedCost)}</b></p></div></div>
          </DocCard>
        </div>

        {/* ═══ CONFORMIDAD ═══ */}
        <div data-tab="condiciones">
          <DocCard icon={<CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Conformidad" ok>
            <p>El cliente declara haber recibido el equipo <strong>{deviceName}</strong> ({repair.code}) funcionando y con los accesorios indicados. La garantía es de <strong>{settings.warrantyDays ?? 30} días</strong> desde la entrega y cubre solo el trabajo descrito. Golpes, líquidos o manipulación de terceros anulan la garantía.</p>
            <p style={{ fontSize: 12, color: "#000", marginTop: 8 }}>Conserva este comprobante. Para verificarlo, escanea el QR o usa el código <strong>{ceCode}</strong>.</p>
          </DocCard>
          <div className="doc-paper-only" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, margin: "40px 20px 0" }}>
            <div style={{ borderTop: "1px solid #000", textAlign: "center", fontSize: 12, color: "#000", paddingTop: 4 }}>Firma del cliente</div>
            <div style={{ borderTop: "1px solid #000", textAlign: "center", fontSize: 12, color: "#000", paddingTop: 4 }}>Entregado por</div>
          </div>
        </div>

        <div className="dk-foot doc-paper-only"><span>{settings.companyName} · Comprobante de entrega {ceCode}</span><span>Gracias por tu confianza </span></div>
      </div>
    </div>
  );
}

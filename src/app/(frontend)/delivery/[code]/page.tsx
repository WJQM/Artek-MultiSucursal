"use client";
import { Backpack, Banknote, CircleCheck, FileText, Handshake, Printer, Smartphone, Tag, User, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { ClientVerify } from "@/frontend/components/ClientVerify";
import { trackUrl, trackHeaders } from "@/frontend/lib/track-client";
import { publicBase } from "@/frontend/lib/public-base";
import { useParams } from "next/navigation";
import { PortalTracker } from "@/frontend/components/PortalTracker";
import { DocPrint, DocBar, DocHead, DocTitle, DocQr, DocBox, DocRow, DocCopies, DocSign, qrSrc, bs } from "@/frontend/components/DocKit";
import { DocSkeleton } from "@/frontend/components/Skeletons";

interface Repair {
  /** Sin sesión ni verificación: solo datos enmascarados y opción de verificar el celular */
  protected?: boolean; canVerify?: boolean;
  imei?: string | null;
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

export default function DeliveryPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [servicesList, setServicesList] = useState<{name: string; price: number}[]>([]);
  const [inventoryList, setInventoryList] = useState<{name: string; price: number}[]>([]);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null; website: string | null; city?: string | null; warrantyDays?: number; abandonDays?: number; terms?: string | null }>({ companyName: "", slogan: "", logo: null, phone: null, email: null, address: null, website: null });
  const [branchParam, setBranchParam] = useState("");

  useEffect(() => { publicBase().then(setBaseUrl); const bp = new URLSearchParams(window.location.search).get("branchId") || ""; setBranchParam(bp); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
  useEffect(() => {
    if (code) {
      (() => { const bp = new URLSearchParams(window.location.search).get("branchId"); return fetch(trackUrl(code, bp), { cache: "no-store", headers: trackHeaders(code) }); })().then(r => r.ok ? r.json() : null).then(d => { if (d && d.multiple) setRepair(d.repairs[0]); else if (d) setRepair(d); setLoading(false); }).catch(() => setLoading(false));
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

  const deliveredDate = new Date(repair.deliveredAt || repair.updatedAt).toLocaleDateString("es-BO", { hourCycle: "h23", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const parsed = parseNotesAll(repair.notes);
  const ceCode = otToCe(repair.code);
  // QR apunta a la versión de plana completa
  const qrUrl = `${baseUrl}/delivery/view/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}`;
  const qrImg = baseUrl ? qrSrc(qrUrl) : "";
  const deviceName = [repair.brand, repair.model || repair.device].filter(Boolean).join(" ");
  const discount = Number(parsed.discount || 0);
  const warrantyDays = settings.warrantyDays ?? 30;
  const warrantyUntil = warrantyDays > 0 ? new Date(new Date(repair.deliveredAt || repair.updatedAt).getTime() + warrantyDays * 86_400_000).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "") : null;
  const lines: [string, string, number | null][] = [
    ...parsed.services.map((name): [string, string, number | null] => ["", name, servicesList.find((x) => x.name === name)?.price ?? null]),
    ...parsed.repuestos.map((name): [string, string, number | null] => ["", name, inventoryList.find((x) => x.name === name)?.price ?? null]),
  ];

  const receipt = (label: string) => (
    <>
      <DocHead s={settings} icon={<CircleCheck size={18} strokeWidth={STROKE} aria-hidden="true" />} label="Comprobante de entrega" code={ceCode} />
      <DocTitle tags={[{ text: label }]}><Handshake size={14} strokeWidth={STROKE} aria-hidden="true" /> Entrega del equipo</DocTitle>
      <div className="dk-grid3">
        <DocQr src={qrImg} caption={<>Escanea para ver<br />tu comprobante y garantía</>} />
        <DocBox icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
          <DocRow label="Nombre" value={repair.clientName || "—"} />
          <DocRow label="Celular" value={repair.clientPhone || "—"} />
          <DocRow label="Orden" value={repair.code} />
          <DocRow label="Entregado" value={deliveredDate} />
        </DocBox>
        <DocBox icon={<Smartphone size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Equipo entregado">
          <DocRow label="Equipo" value={[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")} />
          {repair.imei && <DocRow label={/^\d{15}$/.test(repair.imei) ? "IMEI" : "N° serie"} value={<span className="tabular">{repair.imei}</span>} />}
          {warrantyUntil && <DocRow label="Garantía" value={`hasta ${warrantyUntil}`} />}
        </DocBox>
      </div>
      <div className="dk-two">
        <DocBox icon={<Banknote size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Detalle del cobro">
          {lines.map(([icon, name, price]) => <div key={icon + name} className="dk-line"><span>{icon} {name}</span><b className="tabular">{price != null ? bs(price) : "—"}</b></div>)}
          {discount > 0 && <><div className="dk-line"><span>Subtotal</span><b className="tabular">{bs(Number(repair.estimatedCost) + discount)}</b></div><div className="dk-line minus"><span><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Descuento</span><b className="tabular">− {bs(discount)}</b></div></>}
          <div className="dk-cost"><span>Total cobrado</span><b className="tabular">{bs(repair.estimatedCost)}</b></div>
        </DocBox>
        <DocBox icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios devueltos">
          {checkedAcc.length > 0
            ? <div className="dk-acc">{checkedAcc.map((a) => { const { name, detail } = parseAccWithDetail(a); return <div key={a}>{name}{detail && <i> ({detail})</i>}</div>; })}</div>
            : <span className="dk-empty">Sin accesorios</span>}
          {parsed.deliveryNotes && <div className="dk-block warn" style={{ marginTop: 4 }}><small>Nota de la entrega</small>{parsed.deliveryNotes}</div>}
        </DocBox>
      </div>
      <div className="dk-terms ok"><b className="t"><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Conformidad</b>El cliente recibe el equipo <strong>{deviceName}</strong> ({repair.code}) en condiciones satisfactorias, con los accesorios indicados. Garantía de <strong>{warrantyDays} días</strong> sobre el trabajo realizado; no cubre golpes, líquidos ni manipulación de terceros.</div>
      <DocSign left="Firma del cliente" right="Entregado por" />
    </>
  );

  return (
    <div className="dk dk-green">
      <PortalTracker />
      <DocPrint landscape />
      <DocBar title={<><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Comprobante x2 — {ceCode}</>}>
        <button onClick={() => window.open(`/delivery/view/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}`, "_blank")}><FileText size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Hoja completa</span></button>
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>
      <DocCopies render={receipt} />
    </div>
  );
}

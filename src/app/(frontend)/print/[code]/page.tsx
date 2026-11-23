"use client";
import { Backpack, Printer, Receipt, Smartphone, Stethoscope, User, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { termsLines } from "@/shared/branding";
import { publicBase } from "@/frontend/lib/public-base";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DocPrint, DocBar, DocHead, DocTitle, DocQr, DocBox, DocRow, DocCopies, qrSrc, bs } from "@/frontend/components/DocKit";

interface Repair { warrantyOf?: string | null; imei?: string | null;
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; priority: string; estimatedCost: number;
  notes: string | null; image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const STATUS: Record<string, string> = { pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando Repuestos", in_progress: "En Progreso", completed: "Completado", delivered: "Entregado" };
const PRIORITY: Record<string, string> = { baja: "Baja", alta: "Alta", urgente: "Urgente" };

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }

function parseNotesAll(n: string | null): { notes: string; services: string[]; software: string[]; videogames: string[]; repuestos: string[] } {
  if (!n) return { notes: "", services: [], software: [], videogames: [], repuestos: [] };
  const parts = n.split(" | ");
  const svc = parts.find(p => p.startsWith("Servicios: ")); const sw = parts.find(p => p.startsWith("Programas: ") || p.startsWith("Software: ")); const vg = parts.find(p => p.startsWith("Videojuegos: ")); const rep = parts.find(p => p.startsWith("Repuestos: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Programas: ") && !p.startsWith("Software: ") && !p.startsWith("Videojuegos: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: "));
  return { notes: rest.join(" | "), services: svc ? svc.replace("Servicios: ", "").split(", ").filter(Boolean) : [], software: sw ? sw.replace("Programas: ", "").replace("Software: ", "").split(", ").filter(Boolean) : [], videogames: vg ? vg.replace("Videojuegos: ", "").split(", ").filter(Boolean) : [], repuestos: rep ? rep.replace("Repuestos: ", "").split(", ").filter(Boolean) : [] };
}

export default function PrintPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null; city?: string | null; warrantyDays?: number; abandonDays?: number; terms?: string | null }>({ companyName: "", slogan: "", logo: null, phone: null, email: null, address: null });
  const [branchParam, setBranchParam] = useState("");

  useEffect(() => { publicBase().then(setBaseUrl); const bp = new URLSearchParams(window.location.search).get("branchId") || ""; setBranchParam(bp); fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
  useEffect(() => { if (code) { (() => { const bp = new URLSearchParams(window.location.search).get("branchId"); return fetch(`/api/track/${code}${bp ? `?branchId=${bp}` : ""}`); })().then(r => r.ok ? r.json() : null).then(d => { if (d && d.multiple) setRepair(d.repairs[0]); else if (d) setRepair(d); setLoading(false); }).catch(() => setLoading(false)); } }, [code]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16 }}>Cargando orden...</div>;
  if (!repair) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Orden no encontrada: {code}</div>;

  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { hourCycle: "h23", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const parsed = parseNotesAll(repair.notes);
  const trackUrl = `${baseUrl}/track/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}`;
  // Dos copias lado a lado en hoja carta horizontal: QR grande para que se pueda escanear
  const qrImg = baseUrl ? qrSrc(trackUrl) : "";
  const terms = termsLines(settings);
  const extras: [string, string, string[]][] = [["", "Servicios", parsed.services], ["", "Programas", parsed.software], ["", "Videojuegos", parsed.videogames], ["", "Repuestos", parsed.repuestos]];

  const receipt = (label: string) => (
    <>
      <DocHead s={settings} icon={<Wrench size={18} strokeWidth={STROKE} aria-hidden="true" />} label="Orden de trabajo" code={repair.code} />
      <DocTitle tags={[...(repair.warrantyOf ? [{ text: `Garantía de ${repair.warrantyOf}`, warn: true }] : []), { text: STATUS[repair.status] || repair.status }, { text: label }]}><Receipt size={14} strokeWidth={STROKE} aria-hidden="true" /> Recepción del equipo</DocTitle>
      <div className="dk-grid3">
        <DocQr src={qrImg} caption={<>Escanea para ver<br />el estado de tu equipo</>} />
        <DocBox icon={<User size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Cliente">
          <DocRow label="Nombre" value={repair.clientName || "—"} />
          <DocRow label="Celular" value={repair.clientPhone || "—"} />
          <DocRow label="Recibido" value={createdDate} />
          {repair.priority && repair.priority !== "media" && <DocRow label="Prioridad" value={PRIORITY[repair.priority] || repair.priority} />}
        </DocBox>
        <DocBox icon={<Smartphone size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Equipo">
          <DocRow label="Tipo" value={repair.device} />
          <DocRow label="Marca" value={repair.brand || "—"} />
          <DocRow label="Modelo" value={repair.model || "—"} />
          {repair.imei && <DocRow label={/^\d{15}$/.test(repair.imei) ? "IMEI" : "N° serie"} value={<span className="tabular">{repair.imei}</span>} />}
          <div className="dk-cost"><span>Costo estimado</span><b className="tabular">{repair.estimatedCost == null ? "—" : bs(repair.estimatedCost)}</b></div>
        </DocBox>
      </div>
      <div className="dk-two">
        <DocBox icon={<Stethoscope size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Problema y estado">
          <div className="dk-block"><small>Problema</small>{repair.issue || "—"}</div>
          {parsed.notes && <div className="dk-block warn"><small>Cómo llegó</small>{parsed.notes}</div>}
          {extras.filter(([, , list]) => list.length > 0).map(([icon, title, list]) => <div key={title} className="dk-block"><small>{icon} {title}</small>{list.join(", ")}</div>)}
        </DocBox>
        <DocBox icon={<Backpack size={18} strokeWidth={STROKE} aria-hidden="true" />} title="Accesorios que deja">
          {checkedAcc.length > 0
            ? <div className="dk-acc">{checkedAcc.map((a) => { const { name, detail } = parseAccWithDetail(a); return <div key={a}>{name}{detail && <i> ({detail})</i>}</div>; })}</div>
            : <span className="dk-empty">Sin accesorios</span>}
        </DocBox>
      </div>
      <div className="dk-terms"><b className="t">Términos y condiciones</b>{terms.map((l, i) => `${i + 1}. ${l} `).join("")}{terms.length + 1}. Sigue tu orden con el QR · <strong>{repair.code}</strong>.</div>
    </>
  );

  return (
    <div className="dk">
      <DocPrint landscape />
      <DocBar title={<><Receipt size={14} strokeWidth={STROKE} aria-hidden="true" /> Recepción x2 — {repair.code}</>}>
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>
      <DocCopies render={receipt} />
    </div>
  );
}

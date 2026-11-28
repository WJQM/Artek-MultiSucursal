"use client";
// Etiquetas XS (38×25 mm) para los accesorios de una orden: mini QR de seguimiento, código, accesorio, cliente y fecha.
// Se marcan/desmarcan en la barra; salen varias por hoja con línea de corte. Ruta bajo /print/ para heredar la protección de sesión.
import { Backpack, Printer, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { publicBase } from "@/frontend/lib/public-base";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DocPrint, DocBar, qrSrc } from "@/frontend/components/DocKit";

interface Repair { code: string; accessories: string | null; clientName: string | null; createdAt: string }

const accName = (raw: string) => (raw.match(/^(.+?)\s*\((.+)\)$/)?.[1] ?? raw).trim();
const shortName = (n: string | null) => { const p = (n || "").trim().split(/\s+/).filter(Boolean); return p.length ? (p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]) : ""; };
const fecha = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function AccessoryLabelsPage() {
  const code = useParams().code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [branchParam, setBranchParam] = useState("");
  const [off, setOff] = useState<Set<number>>(new Set());

  useEffect(() => {
    publicBase().then(setBaseUrl);
    const bp = new URLSearchParams(window.location.search).get("branchId") || "";
    setBranchParam(bp); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/track/${code}${bp ? `?branchId=${bp}` : ""}`).then(r => r.ok ? r.json() : null)
      .then(d => { setRepair(d?.multiple ? d.repairs[0] : d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", color: "#666" }}>Cargando…</div>;
  if (!repair) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", color: "#e44" }}>No se encontró la orden {code}.</div>;

  const items: string[] = (() => { try { return (JSON.parse(repair.accessories || "[]") as string[]).map(accName).filter(Boolean); } catch { return []; } })();
  const chosen = items.map((name, i) => ({ name, i })).filter(({ i }) => !off.has(i));
  const trackUrl = baseUrl ? `${baseUrl}/track/${repair.code}${branchParam ? `?branchId=${branchParam}` : ""}` : "";
  const qr = qrSrc(trackUrl, 240);
  const toggle = (i: number) => setOff(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const sub = [shortName(repair.clientName), fecha(repair.createdAt)].filter(Boolean).join(" · ");

  return (
    <div className="dk">
      <DocPrint margin="8mm" />
      <DocBar title={<><Backpack size={14} strokeWidth={STROKE} aria-hidden="true" /> Etiquetas de accesorios · {repair.code}</>}>
        {items.map((name, i) => (
          <button key={i} className={off.has(i) ? undefined : "go"} aria-pressed={!off.has(i)} onClick={() => toggle(i)}>{name}</button>
        ))}
        <button onClick={() => window.print()} disabled={!chosen.length}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      </DocBar>
      <div style={{ padding: "100px 16px 28px", display: "flex", justifyContent: "center" }}>
        {!items.length ? <p style={{ fontFamily: "Arial", color: "#666" }}>Esta orden no tiene accesorios registrados.</p>
          : !chosen.length ? <p style={{ fontFamily: "Arial", color: "#666" }}>Marca al menos un accesorio arriba.</p>
          : (
            <div className="acc-sheet">
              {chosen.map(({ name, i }, k) => (
                <div key={i} className="acc-lbl">
                  {qr ? <img src={qr} alt="Código QR" /> : <span className="acc-qr-ph" />}
                  <div className="acc-txt">
                    <b>{repair.code}</b>
                    <span className="acc-name">{name}</span>
                    {sub && <small>{sub}</small>}
                    <small>{k + 1} de {chosen.length}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

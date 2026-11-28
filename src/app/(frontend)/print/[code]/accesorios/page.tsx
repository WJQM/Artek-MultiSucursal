"use client";
// Etiquetas de accesorios de una orden en tres formatos: S 48×30 (una por accesorio), Bandera 96×30 (se dobla alrededor del cable)
// y Única 50×30 (un QR con la lista). El modal pasa ?f=formato&off=índices desmarcados; la barra permite cambiarlos. Ruta bajo /print/ para heredar la sesión.
import { Backpack, Printer, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { publicBase } from "@/frontend/lib/public-base";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DocPrint, DocBar, qrSrc } from "@/frontend/components/DocKit";

interface Repair { code: string; accessories: string | null; clientName: string | null; createdAt: string }
type Fmt = "s" | "bandera" | "unica";

const FMTS: { k: Fmt; label: string }[] = [{ k: "s", label: "S 48×30" }, { k: "bandera", label: "Bandera" }, { k: "unica", label: "Única" }];
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
  const [fmt, setFmt] = useState<Fmt>("s");

  useEffect(() => {
    publicBase().then(setBaseUrl);
    const q = new URLSearchParams(window.location.search);
    const bp = q.get("branchId") || "";
    setBranchParam(bp); // eslint-disable-line react-hooks/set-state-in-effect
    const f = q.get("f");
    if (f === "bandera" || f === "unica") setFmt(f);
    const o = (q.get("off") || "").split(",").filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
    if (o.length) setOff(new Set(o));
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
  const qrImg = qr ? <img src={qr} alt="Código QR" /> : <span className="acc-qr-ph" />;

  return (
    <div className="dk">
      <DocPrint margin="8mm" />
      <DocBar title={<><Backpack size={14} strokeWidth={STROKE} aria-hidden="true" /> Etiquetas de accesorios · {repair.code}</>}>
        {FMTS.map(({ k, label }) => (
          <button key={k} className={fmt === k ? "go" : undefined} aria-pressed={fmt === k} onClick={() => setFmt(k)}>{label}</button>
        ))}
        <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.25)", margin: "0 4px" }} />
        {items.map((name, i) => (
          <button key={i} className={off.has(i) ? undefined : "go"} aria-pressed={!off.has(i)} onClick={() => toggle(i)}>{name}</button>
        ))}
        <button onClick={() => window.print()} disabled={!chosen.length}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      </DocBar>
      <div className="acc-page" style={{ padding: "100px 16px 28px", display: "flex", justifyContent: "center" }}>
        {!items.length ? <p style={{ fontFamily: "Arial", color: "#666" }}>Esta orden no tiene accesorios registrados.</p>
          : !chosen.length ? <p style={{ fontFamily: "Arial", color: "#666" }}>Marca al menos un accesorio arriba.</p>
          : fmt === "unica" ? (
            <div className="acc-sheet acc-sheet-unica">
              <div className="acc-lbl acc-unica">
                {qrImg}
                <div className="acc-txt">
                  <b>{repair.code}</b>
                  {sub && <small>{sub}</small>}
                  <ul>{chosen.map(({ name, i }) => <li key={i}>✓ {name}</li>)}</ul>
                </div>
              </div>
            </div>
          ) : fmt === "bandera" ? (
            <div className="acc-sheet acc-sheet-bandera">
              {chosen.map(({ name, i }) => (
                <div key={i} className="acc-lbl acc-bandera">
                  {[0, 1].map((side) => (
                    <div key={side} className="acc-half">
                      {qrImg}
                      <div className="acc-txt"><b>{repair.code}</b><span className="acc-name">{name}</span></div>
                    </div>
                  )).flatMap((half, k) => (k === 0 ? [half, <span key="fold" className="acc-fold">doblar</span>] : [half]))}
                </div>
              ))}
            </div>
          ) : (
            <div className="acc-sheet">
              {chosen.map(({ name, i }, k) => (
                <div key={i} className="acc-lbl">
                  {qrImg}
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

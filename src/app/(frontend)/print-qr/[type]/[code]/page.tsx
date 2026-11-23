"use client";
import { Link2, Printer, Tag, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { publicBase } from "@/frontend/lib/public-base";
import { useParams } from "next/navigation";
import { DocPrint, DocBar, type DocCompany } from "@/frontend/components/DocKit";
import { QrLabel, type LabelSize } from "@/frontend/components/ProductPrint";

type DocType = "ot" | "ce" | "cot" | "nv" | "cl";

// Mismos colores que los documentos: OT azul oscuro, CE y NV verde, COT ámbar, CL dorado
const TYPES: Record<DocType, { title: string; kind: string; color: string; pathFn: (code: string, branchId: string) => string; codeDisplay: (code: string) => string }> = {
  ot: { title: "Sigue tu equipo", kind: "Orden de trabajo", color: "#1e2a3a", pathFn: (code, bid) => `/track/${code}${bid ? `?branchId=${bid}` : ""}`, codeDisplay: (code) => code },
  ce: { title: "Comprobante y garantía", kind: "Entrega", color: "#047857", pathFn: (code, bid) => `/delivery/${code}${bid ? `?branchId=${bid}` : ""}`, codeDisplay: (code) => `CE-${code.replace(/^OT-/i, "")}` },
  cot: { title: "Ver la cotización", kind: "Cotización", color: "#b45309", pathFn: (code, bid) => `/quotations/print/${code}${bid ? `?branchId=${bid}` : ""}`, codeDisplay: (code) => code },
  nv: { title: "Ver la nota de venta", kind: "Nota de venta", color: "#047857", pathFn: (code, bid) => `/quotations/print/${code}${bid ? `?branchId=${bid}` : ""}`, codeDisplay: (code) => code },
  cl: { title: "Verificar licencias", kind: "Certificado", color: "#b45309", pathFn: (code, bid) => `/certificate-view/${code}${bid ? `?branchId=${bid}` : ""}`, codeDisplay: (code) => code },
};

export default function PrintQRPage() {
  const params = useParams();
  const type = (params.type as string)?.toLowerCase() as DocType;
  const code = params.code as string;
  const [baseUrl, setBaseUrl] = useState("");
  const [branchId, setBranchId] = useState("");
  const [size, setSize] = useState<LabelSize>("medium");
  const [settings, setSettings] = useState<DocCompany>({ companyName: "", logo: null });

  useEffect(() => {
    publicBase().then(setBaseUrl);
    setBranchId(new URLSearchParams(window.location.search).get("branchId") || ""); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, logo: d.logo }); }).catch(() => {});
  }, []);

  const cfg = TYPES[type];
  if (!cfg) {
    return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>
      Tipo de documento no válido: {type}. Usa: ot, ce, cot, nv, cl.
    </div>;
  }

  const displayCode = cfg.codeDisplay(code);
  const targetUrl = baseUrl ? `${baseUrl}${cfg.pathFn(code, branchId)}` : "";

  return (
    <div className="dk">
      <DocPrint margin="6mm" />
      <DocBar title={<><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> Etiqueta QR · {displayCode}</>}>
        {(["small", "medium", "large"] as LabelSize[]).map((k) => (
          <button key={k} className={size === k ? "go" : undefined} onClick={() => setSize(k)} aria-label={`Tamaño ${k}`}>{k === "small" ? "S" : k === "medium" ? "M" : "L"}</button>
        ))}
        <button onClick={() => { navigator.clipboard.writeText(targetUrl); }}><Link2 size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Copiar enlace</span></button>
        <button onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      </DocBar>
      <div className="dk-sticker-wrap" style={{ display: "flex", justifyContent: "center", padding: "100px 16px 28px" }}>
        <QrLabel s={settings} kind={cfg.kind} color={cfg.color} code={displayCode} name={cfg.title} url={targetUrl} size={size} />
      </div>
    </div>
  );
}

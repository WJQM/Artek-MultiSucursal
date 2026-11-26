"use client";
import { Printer, Tag, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { DocBar } from "@/frontend/components/DocKit";
import { QrLabel, type LabelSize } from "@/frontend/components/ProductPrint";

// Etiquetas por hoja carta según el tamaño elegido
const SIZE_CONFIG: Record<"S" | "M" | "L", { cols: number; perPage: number; label: LabelSize }> = {
  S: { cols: 4, perPage: 20, label: "small" },
  M: { cols: 3, perPage: 9, label: "medium" },
  L: { cols: 2, perPage: 4, label: "large" },
};

// Mismo color por tipo que en el resto de documentos
const KIND: Record<string, { label: string; color: string }> = {
  consoles: { label: "Consola", color: "#c2410c" },
  equipment: { label: "Equipo", color: "#0e7490" },
};

interface BatchItem { id: string; name: string; code?: string; price?: number; kind: string; qrUrl: string }
interface BatchData { items: BatchItem[]; size: "S" | "M" | "L"; showLogo?: boolean; companyName?: string; logo?: string | null }

export default function QrBatchPrintPage() {
  const [data, setData] = useState<BatchData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("qrBatchData");
    if (stored) {
      try { setData(JSON.parse(stored)); } catch {} // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    }
  }, []);

  useEffect(() => {
    if (data && data.items?.length > 0) {
      // Esperar a que los QRs se generen antes de imprimir
      const t = setTimeout(() => window.print(), 1200);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#fff", color: "#000", minHeight: "100vh" }}>
        <h2>No hay datos para imprimir</h2>
        <p>Vuelve a la página anterior y selecciona items.</p>
      </div>
    );
  }

  const config = SIZE_CONFIG[data.size] || SIZE_CONFIG.M;
  const pages: BatchItem[][] = [];
  for (let i = 0; i < data.items.length; i += config.perPage) pages.push(data.items.slice(i, i + config.perPage));
  const company = data.showLogo ? { companyName: data.companyName || "", logo: data.logo || null } : undefined;

  return (
    <div className="dk">
      <style>{`
        @page { size: letter; margin: 8mm; }
        @media print {
          .qr-page { page-break-after: always; margin: 0 !important; padding: 0 !important; border: 0 !important; }
          .qr-page:last-child { page-break-after: auto; }
        }
        @media screen { .qr-page { margin: 20px auto; padding: 10mm; border: 1px dashed #cbd5e1; max-width: 215.9mm; } }
      `}</style>
      <DocBar title={<><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /> {data.items.length} etiquetas · tamaño {data.size} · {pages.length} hoja{pages.length !== 1 ? "s" : ""}</>}>
        <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>
      <div style={{ paddingTop: 60 }}>
        {pages.map((pageItems, pageIdx) => (
          <div key={pageIdx} className="qr-page" style={{ display: "grid", gridTemplateColumns: `repeat(${config.cols}, 1fr)`, gap: 10, justifyItems: "center" }}>
            {pageItems.map((item) => {
              const k = KIND[item.kind] || KIND.equipment;
              return <QrLabel key={item.id} s={company} kind={k.label} color={k.color} code={item.code || ""} name={item.name} sub={item.price ? `Bs. ${item.price}` : undefined} url={item.qrUrl} size={config.label} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

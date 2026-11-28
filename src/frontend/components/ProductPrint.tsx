"use client";
import { Columns2, Eye, FileText, Printer, Tag, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Ficha de venta (EQ, CN) para pegar junto al producto: hoja completa, media hoja (dos fichas iguales en una
// carta horizontal, con línea de corte) o solo la etiqueta QR (modo "sticker").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { closePage } from "@/frontend/lib/close-page";
import { DocPrint, DocBar, DocHero, DocHead, DocCopies, qrSrc, bs, type DocCompany } from "@/frontend/components/DocKit";

export interface ProductSpec { icon: ReactNode; label: string; value: string }
export type LabelSize = "small" | "medium" | "large";

/** Etiqueta QR: franja con el color del tipo, QR grande, código y nombre. */
export function QrLabel({ s, kind, color, code, name, sub, url, size = "medium" }: {
  s?: DocCompany; kind: string; color: string; code: string; name: string; sub?: string; url: string; size?: LabelSize;
}) {
  const px = { small: 110, medium: 160, large: 240 }[size];
  return (
    <div className={`dk-label ${size}`}>
      {s?.companyName && <div className="co">{s.companyName}</div>}
      <span className="k" style={{ background: color }}>{kind}</span>
      { }
      {url ? <img src={qrSrc(url, px * 2)} alt="Código QR" width={px} height={px} /> : <div style={{ width: px, height: px, background: "var(--bg-hover)", margin: "8px auto" }} />}
      <b>{code}</b>
      <p>{name}</p>
      <small>{sub ? `${sub} · ` : ""}Escanea</small>
    </div>
  );
}

export function ProductPrint({ s, icon, docLabel, kind, kindColor, cond, code, name, price, image, url, specs, accessories, notes, branch, warranty }: {
  s: DocCompany; icon: ReactNode; docLabel: string; kind: string; kindColor: string; cond: { label: string };
  code: string; name: string; price: number; image: string | null; url: string; specs: ProductSpec[];
  accessories?: string | null; notes?: string | null; branch?: string | null; warranty?: string | null;
}) {
  type Modo = "full" | "half" | "sticker";
  const [mode, setMode] = useState<Modo>(() => {
    const m = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mode") : null;
    return m === "sticker" ? "sticker" : m === "media" ? "half" : "full";
  });
  const [size, setSize] = useState<LabelSize>("medium");
  // Seguro final: si la ficha no cabe en una hoja carta (notas muy largas…), al imprimir se achica
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ajustar = () => {
      const el = pageRef.current; if (!el) return;
      el.style.zoom = "";
      const kids = [...el.children].filter((c) => !c.classList.contains("no-print")) as HTMLElement[];
      if (!kids.length) return;
      const alto = kids[kids.length - 1].getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top;
      const cabe = (11 * 96) - 2 * (10 / 25.4) * 96 - 12; // carta menos los márgenes de 10 mm
      if (alto > cabe) el.style.zoom = String(Math.floor((cabe / alto) * 100) / 100);
    };
    const quitar = () => { if (pageRef.current) pageRef.current.style.zoom = ""; };
    window.addEventListener("beforeprint", ajustar);
    window.addEventListener("afterprint", quitar);
    return () => { window.removeEventListener("beforeprint", ajustar); window.removeEventListener("afterprint", quitar); };
  }, []);
  const switchMode = (m: Modo) => {
    setMode(m);
    const u = new URL(window.location.href);
    if (m === "full") u.searchParams.delete("mode"); else u.searchParams.set("mode", m === "half" ? "media" : "sticker");
    window.history.replaceState({}, "", u.toString());
  };

  return (
    <div className="dk">
      <DocPrint landscape={mode === "half"} margin={mode === "sticker" ? "6mm" : mode === "half" ? "8mm" : "10mm"} />
      <DocBar title={<>{mode === "sticker" ? "Etiqueta QR" : mode === "half" ? "Media hoja" : "Ficha"} · {code}</>}>
        <button className={mode === "full" ? "go" : undefined} onClick={() => switchMode("full")}><FileText size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Ficha</span></button>
        <button className={mode === "half" ? "go" : undefined} onClick={() => switchMode("half")}><Columns2 size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Media hoja</span></button>
        <button className={mode === "sticker" ? "go" : undefined} onClick={() => switchMode("sticker")}><Tag size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Solo QR</span></button>
        {mode === "sticker" && (["small", "medium", "large"] as LabelSize[]).map((k) => (
          <button key={k} className={size === k ? "go" : undefined} onClick={() => setSize(k)} aria-label={`Tamaño ${k}`}>{k === "small" ? "S" : k === "medium" ? "M" : "L"}</button>
        ))}
        <button onClick={() => { if (url) window.open(url, "_blank"); }}><Eye size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Ver en portal</span></button>
        <button onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      </DocBar>

      {mode === "sticker" ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px 16px 28px" }} className="dk-sticker-wrap">
          <QrLabel s={s} kind={kind} color={kindColor} code={code} name={name} sub={bs(price)} url={url} size={size} />
        </div>
      ) : mode === "half" ? (
        <DocCopies render={() => (
          <FichaMedia s={s} icon={icon} docLabel={docLabel} kind={kind} cond={cond} code={code} name={name} price={price} image={image} url={url} specs={specs} accessories={accessories} warranty={warranty} />
        )} />
      ) : (
        <div className="dk-page print-content" ref={pageRef}>
          <DocHero s={s} icon={icon} label={docLabel} code={code} sub={branch || undefined} />
          <div className="dk-prod">
            <div className="ph">
              { }
              {image ? <img src={image} alt={name} /> : <span aria-hidden="true">{icon}</span>}
            </div>
            <div>
              <p className="kind">{kind} · {cond.label}</p>
              <h2>{name}</h2>
              <div className="price"><small>Precio</small><b className="tabular">{bs(price)}</b></div>
              <div className="dk-pay" style={{ marginTop: 16 }}>
                { }
                {url ? <img src={qrSrc(url, 240)} alt="Código QR" /> : null}
                <div><b>Escanea</b><br />para ver fotos y<br />pedirlo por WhatsApp</div>
              </div>
            </div>
          </div>
          {specs.length > 0 && (
            <>
              <h3 className="dk-h3">Especificaciones</h3>
              <div className="dk-specs">
                {specs.map((sp) => <div key={sp.label}><small>{sp.icon} {sp.label}</small><b>{sp.value}</b></div>)}
              </div>
            </>
          )}
          {accessories && <Incluye text={accessories} cols={3} size={13.5} style={{ marginTop: 10, padding: "7px 10px" }} />}
          {notes && <div className="dk-block warn" style={{ marginTop: 10, fontSize: 12.5 }}><small>Notas</small>{notes}</div>}
          <div className="dk-foot"><span>{warranty || s.companyName}</span><span>Pregunta por pagos con QR </span></div>
          <p className="no-print" style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: "var(--text-muted)" }}>Imprime esta hoja y pégala junto al producto. El cliente escanea el QR para ver fotos y pedirlo.</p>
        </div>
      )}
    </div>
  );
}

/** Ficha compacta para media hoja carta (14 × 21,6 cm): banda, foto, precio, QR y hasta 6 especificaciones.
 *  También la usan las fichas por lote (/qr-batch/fichas). */
export function FichaMedia({ s, icon, docLabel, kind, cond, code, name, price, image, url, specs, accessories, warranty }: {
  s: DocCompany; icon: ReactNode; docLabel: string; kind: string; cond: { label: string }; code: string; name: string;
  price: number; image: string | null; url: string; specs: ProductSpec[]; accessories?: string | null; warranty?: string | null;
}) {
  const box = { border: "1px solid #000", borderRadius: 6 } as const;
  // Ocupa todo el alto de la media hoja (carta horizontal menos márgenes): el pie queda abajo
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: "7.5in" }}>
      <DocHead s={s} label={docLabel} code={code} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ ...box, aspectRatio: "1 / 1", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", color: "#999", background: "#fff" }}>
          {image ? <img src={image} alt={name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", padding: 6 }} /> : <span aria-hidden="true" style={{ display: "grid", transform: "scale(3.5)", color: "#b8bfc9" }}>{icon}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: "#444", margin: 0 }}>{kind} · {cond.label}</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, margin: "3px 0 10px", overflowWrap: "anywhere" }}>{name}</h2>
          <div style={{ borderTop: "1.5px solid var(--doc-accent)", paddingTop: 4 }}>
            <small style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--doc-accent)" }}>Precio</small>
            <b className="tabular" style={{ fontSize: 26 }}>{bs(price)}</b>
          </div>
        </div>
      </div>
      <div style={{ ...box, display: "flex", gap: 10, alignItems: "center", padding: 6 }}>
        {url ? <img src={qrSrc(url, 200)} alt="Código QR" width={68} height={68} style={{ flexShrink: 0 }} /> : null}
        <div style={{ fontSize: 11.5, lineHeight: 1.4 }}><b>Escanea</b> para ver fotos y pedirlo por WhatsApp</div>
      </div>
      {specs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {specs.slice(0, 6).map((sp) => (
            <div key={sp.label} style={{ ...box, padding: 0, minWidth: 0, overflow: "hidden" }}>
              <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--doc-band, #000)", padding: "2px 8px" }}>{sp.label}</small>
              <b style={{ display: "block", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "3px 8px 4px" }}>{sp.value}</b>
            </div>
          ))}
        </div>
      )}
      {accessories && <Incluye text={accessories} cols={3} size={12} max={9} style={{ padding: "4px 8px" }} />}
      <div style={{ marginTop: "auto", borderTop: ".5px solid #000", paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: "#444" }}>
        <span>{warranty || s.companyName}</span><span>Pregunta por pagos con QR</span>
      </div>
    </div>
  );
}

/** "Caja, Cargador" → ["Caja", "Cargador"] (también separa por punto y coma o salto de línea) */
const listaIncluye = (t: string) => t.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

/** Recuadro "Incluye" con un accesorio por viñeta, en columnas (igual en la ficha completa y en la media hoja) */
function Incluye({ text, cols, size, max, style }: { text: string; cols: number; size: number; max?: number; style?: React.CSSProperties }) {
  const items = listaIncluye(text);
  const vis = max && items.length > max ? items.slice(0, max - 1) : items;
  const resto = items.length - vis.length;
  const { padding, ...rest } = style || {};
  // Etiqueta "Incluye" como franja rellena con el color Oscuro (igual que las especificaciones y los comprobantes)
  return (
    <div style={{ border: "1px solid #000", borderRadius: 6, breakInside: "avoid", overflow: "hidden", ...rest }}>
      <small style={{ display: "block", fontSize: size - 2.5, fontWeight: 700, color: "#fff", background: "var(--doc-band, #000)", padding: "2px 10px" }}>Incluye</small>
      <ul style={{ listStyle: "none", margin: 0, padding: padding ?? "6px 10px", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "2px 12px", fontSize: size, fontWeight: 600 }}>
        {vis.map((x, i) => <li key={i} style={{ display: "flex", gap: 6, minWidth: 0 }}><span aria-hidden="true" style={{ color: "var(--doc-accent)" }}>•</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x}</span></li>)}
        {resto > 0 && <li style={{ color: "#444" }}>y {resto} más</li>}
      </ul>
    </div>
  );
}

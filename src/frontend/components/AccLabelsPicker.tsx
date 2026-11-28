"use client";
// Opción del modal "Imprimir Recepción": al tocarla se despliega con una casilla por accesorio y el formato de etiqueta.
import { useState } from "react";

export type AccLabelFmt = "xs" | "bandera" | "unica";
const FMTS: { k: AccLabelFmt; label: string }[] = [{ k: "xs", label: "XS 38×25" }, { k: "bandera", label: "Bandera" }, { k: "unica", label: "Única" }];

export function AccLabelsPicker({ items, onPrint }: { items: string[]; onPrint: (off: number[], fmt: AccLabelFmt) => void }) {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<number[]>([]);
  const [fmt, setFmt] = useState<AccLabelFmt>("xs");
  const toggle = (i: number) => setOff((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const count = items.length - off.length;

  if (!open) {
    return (
      <button type="button" className="alp" onClick={() => setOpen(true)}>
        <span className="alp-t">Etiquetas para accesorios</span>
        <span className="alp-d">Mini QR para cargador, funda, batería…</span>
      </button>
    );
  }
  return (
    <div className="alp alp-open">
      <span className="alp-t">Etiquetas para accesorios</span>
      <span className="alp-d">Marca los que llevan etiqueta</span>
      <div className="alp-list">
        {items.map((name, i) => (
          <label key={i}><input type="checkbox" checked={!off.includes(i)} onChange={() => toggle(i)} /> {name}</label>
        ))}
      </div>
      <div className="alp-fmts" role="radiogroup" aria-label="Formato de etiqueta">
        {FMTS.map(({ k, label }) => (
          <button key={k} type="button" role="radio" aria-checked={fmt === k} className={fmt === k ? "on" : undefined} onClick={() => setFmt(k)}>{label}</button>
        ))}
      </div>
      <button type="button" className="alp-go" disabled={!count} onClick={() => onPrint(off, fmt)}>
        {fmt === "unica" ? "Imprimir etiqueta" : `Imprimir ${count} etiqueta${count === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

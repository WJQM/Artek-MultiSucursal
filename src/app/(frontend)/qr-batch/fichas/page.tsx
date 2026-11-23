"use client";
import { Printer, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { closePage } from "@/frontend/lib/close-page";
import { apiFetch } from "@/frontend/lib/api";
import { publicBase } from "@/frontend/lib/public-base";
import { DocBar, DocPair, DocPrint, type DocCompany } from "@/frontend/components/DocKit";
import { FichaMedia } from "@/frontend/components/ProductPrint";
import { DocSkeleton } from "@/frontend/components/Skeletons";
import { consoleFicha, equipmentFicha, type ConsoleLike, type EquipmentLike, type FichaData } from "@/frontend/lib/fichas";

// Fichas por lote: equipos y consolas elegidos en "Imprimir QR múltiples" › Fichas en media hoja.
// Van de a dos por carta horizontal, en el orden en que se marcaron; si son impares, la última mitad queda en blanco.

type Elegida = { kind: "equipment" | "consoles"; id: string };

export default function FichasLotePage() {
  const [s, setS] = useState<DocCompany>({ companyName: "", logo: null });
  const [fichas, setFichas] = useState<FichaData[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setS(d); }).catch(() => {});
    let elegidas: Elegida[] = [];
    try { elegidas = JSON.parse(sessionStorage.getItem("fichasBatch") || "[]"); } catch { /* sin datos */ }
    if (!Array.isArray(elegidas) || elegidas.length === 0) { setError("No hay fichas elegidas. Vuelve a Imprimir QR múltiples › Fichas en media hoja."); return; } // eslint-disable-line react-hooks/set-state-in-effect -- datos que dejó la pantalla anterior
    (async () => {
      try {
        const base = await publicBase();
        const [eqR, cnR] = await Promise.all([
          elegidas.some(e => e.kind === "equipment") ? apiFetch("/api/equipment") : null,
          elegidas.some(e => e.kind === "consoles") ? apiFetch("/api/consoles") : null,
        ]);
        const eqs: EquipmentLike[] = eqR && eqR.ok ? await eqR.json() : [];
        const cns: ConsoleLike[] = cnR && cnR.ok ? await cnR.json() : [];
        const lista = elegidas.map(e => {
          if (e.kind === "equipment") { const eq = eqs.find(x => x.id === e.id); return eq ? equipmentFicha(eq, base) : null; }
          const cn = cns.find(x => x.id === e.id); return cn ? consoleFicha(cn, base) : null;
        }).filter((f): f is FichaData => !!f);
        if (lista.length === 0) setError("No se encontraron las fichas elegidas (quizá se vendieron o se borraron).");
        else setFichas(lista);
      } catch { setError("No se pudo cargar. Revisa tu internet e intenta de nuevo."); }
    })();
  }, []);

  const hojas: [FichaData, FichaData | null][] = [];
  if (fichas) for (let i = 0; i < fichas.length; i += 2) hojas.push([fichas[i], fichas[i + 1] || null]);
  const media = (f: FichaData) => <FichaMedia s={s} icon={f.icon} docLabel={f.docLabel} kind={f.kind} cond={f.cond} code={f.code} name={f.name} price={f.price} image={f.image} url={f.url} specs={f.specs} accessories={f.accessories} />;

  if (!fichas && !error) return <DocSkeleton />;

  return (
    <div className="dk">
      <DocPrint landscape margin="8mm" />
      <DocBar title={<>Fichas en media hoja · {fichas ? `${fichas.length} ficha${fichas.length !== 1 ? "s" : ""} en ${hojas.length} hoja${hojas.length !== 1 ? "s" : ""}` : ""}</>}>
        {fichas && <button className="go" onClick={() => window.print()}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>}
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>
      {error && <p role="alert" style={{ maxWidth: 520, margin: "120px auto", textAlign: "center", fontSize: 15, border: "1px solid #000", borderRadius: 6, padding: "24px 20px" }}>{error}</p>}
      {hojas.map(([a, b], i) => (
        <DocPair key={i} breakAfter={i < hojas.length - 1} left={media(a)} right={b ? media(b) : <div aria-hidden="true" />} />
      ))}
    </div>
  );
}

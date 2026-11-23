"use client";
import { ChevronLeft, ChevronRight } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { thumb } from "@/shared/thumb";
import { useEffect, useState } from "react";
import localFont from "next/font/local";

// Letra con serifa del título (Playfair Display, la misma familia del certificado), guardada en el proyecto
const serifa = localFont({ src: "../fonts/playfair-display-600-italic-latin.woff2", weight: "600", style: "italic", display: "swap" });

// Portada del portal: carrusel con las novedades de todo el catálogo (solo lo que tiene foto).
// Pasa solo cada 5 s, se detiene con el mouse encima o con el foco dentro, y no se mueve solo
// si el celular/PC pide "reducir movimiento". Tocar una foto abre su ficha.

export interface NuevoItem { key: string; img: string; tipo: string; nombre: string; precio: number | null; abrir: () => void }

export function PortalNewCarousel({ items }: { items: NuevoItem[] }) {
  const [idx, setIdx] = useState(0);
  const [pausa, setPausa] = useState(false);
  const n = items.length;
  const i = n ? idx % n : 0; // si la lista cambia (llega algo nuevo), nunca queda fuera de rango

  // Cada foto se queda 5 s; si el cliente toca una flecha o un punto, vuelve a contar desde cero
  useEffect(() => {
    if (pausa || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIdx((v) => v + 1), 5000);
    return () => clearTimeout(t);
  }, [pausa, n, idx]);

  if (!n) return null;
  const it = items[i];
  const ir = (d: number) => setIdx((v) => ((v % n) + d + n) % n);

  return (
    <section className="pt-new" aria-roledescription="carrusel" aria-label="Novedades"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <h2 className="pt-new-head"><span className={serifa.className}>Novedades</span></h2>
      <button type="button" className="pt-new-slide" onClick={it.abrir} aria-label={`Ver ${it.nombre}`}>
        {items.map((x, k) => (
          <img key={x.key} src={thumb(x.img, 800)} alt="" aria-hidden={k !== i} className={k === i ? "on" : undefined}
            loading={k === 0 ? "eager" : "lazy"} decoding="async" />
        ))}
      </button>
      {n > 1 && <>
        <button type="button" className="pt-new-arr l" onClick={() => ir(-1)} aria-label="Anterior"><ChevronLeft size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        <button type="button" className="pt-new-arr r" onClick={() => ir(1)} aria-label="Siguiente"><ChevronRight size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
      </>}
      <div className="pt-new-cap" aria-live={pausa ? "polite" : "off"}>
        <div><small>{it.tipo}</small><b>{it.nombre}</b></div>
        {it.precio != null && it.precio > 0 && <span>Bs. {Math.round(it.precio).toLocaleString("es-BO")}</span>}
      </div>
      <div className="pt-new-foot">
        {n > 1 && <div className="pt-new-dots">{items.map((x, k) => (
          <button key={x.key} type="button" className={k === i ? "on" : undefined} onClick={() => setIdx(k)} aria-label={`Ir a ${x.nombre}`} aria-current={k === i ? "true" : undefined} />
        ))}</div>}
        <span>{i + 1} de {n}</span>
      </div>
    </section>
  );
}

/** Esqueleto del carrusel mientras carga el catálogo o no hay conexión (misma forma y tamaño). */
export function PortalNewSkeleton() {
  const bar = (w: number | string, h: number, extra?: React.CSSProperties) => <div className="skeleton" style={{ width: w, height: h, borderRadius: 7, ...extra }} />;
  return (
    <div className="pt-new" role="status" aria-busy="true" style={{ padding: "16px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="sr-only">Cargando novedades…</span>
      {bar(140, 24, { alignSelf: "center" })}
      <div className="skeleton" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 12 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>{bar("40%", 11)}{bar("70%", 16)}</div>
        {bar(80, 20)}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>{[18, 7, 7, 7].map((w, i) => <div key={i} className="skeleton" style={{ width: w, height: 7, borderRadius: 4 }} />)}</div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

/** Paginación « ‹ 1 … 4 5 6 … 20 › » (mismo estilo que el Panel) */
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const nav = (disabled: boolean): React.CSSProperties => ({
    padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
    background: disabled ? "var(--bg-tertiary)" : "var(--bg-card)", color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, minWidth: 38,
  });
  const items = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc: (number | string)[], p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push(`…${p}`);
      acc.push(p);
      return acc;
    }, []);
  return (
    <nav aria-label="Paginación" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
      <button type="button" onClick={() => onChange(1)} disabled={page === 1} aria-label="Primera página" className="rt-pg" style={nav(page === 1)}>«</button>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior" className="rt-pg" style={nav(page === 1)}>‹</button>
      {items.map((p) =>
        typeof p === "string" ? (
          <span key={p} style={{ padding: "8px 4px", fontSize: 12, color: "var(--text-muted)" }}>…</span>
        ) : (
          <button key={p} className="rt-pg" type="button" onClick={() => onChange(p)} aria-current={p === page ? "page" : undefined}
            style={{ padding: "8px 14px", borderRadius: 8, border: p === page ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: p === page ? "rgba(var(--accent-bright-rgb), 0.08)" : "var(--bg-card)", color: p === page ? "var(--accent-dim)" : "var(--text-secondary)", fontSize: 12, fontWeight: p === page ? 800 : 600, cursor: "pointer", minWidth: 38 }}>
            {p}
          </button>
        )
      )}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Página siguiente" className="rt-pg" style={nav(page === totalPages)}>›</button>
      <button type="button" onClick={() => onChange(totalPages)} disabled={page === totalPages} aria-label="Última página" className="rt-pg" style={nav(page === totalPages)}>»</button>
      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>Pág {page} de {totalPages}</span>
    </nav>
  );
}

/**
 * Paginación de una lista ya filtrada. Vuelve a la página 1 cuando cambia `resetKey`
 * (búsqueda, filtros) y se ajusta sola si la lista se achica (p. ej. al borrar).
 */
export function usePaged<T>(list: T[], size: number, resetKey: string = "") {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) { setLastKey(resetKey); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    totalPages,
    items: list.slice((current - 1) * size, current * size),
    goTo: (p: number) => { setPage(p); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); },
  };
}

/**
 * Rejilla de catálogo (Programas, Videojuegos, Consolas, Equipos, Productos, Repuestos):
 * 5 columnas en computadora, 4 o 3 en pantallas medianas y 2 en celular, según el ancho real
 * disponible (con o sin menú lateral). La página muestra 7 filas: pageSize = columnas × 7.
 */
export function useCatalogGrid() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(5);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w >= 1200 ? 6 : w >= 1000 ? 5 : w >= 760 ? 4 : w >= 540 ? 3 : 2);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return {
    cols,
    pageSize: cols * 7,
    gridProps: {
      ref: setEl,
      className: "catalog-grid",
      "data-cols": String(cols),
      "data-compact": cols === 2 ? "1" : undefined,
      style: { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: cols === 2 ? 10 : 16 } as React.CSSProperties,
    },
  };
}

/** Orden alfabético: ignora mayúsculas y acentos; "Office 2" antes que "Office 10". */
export const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });

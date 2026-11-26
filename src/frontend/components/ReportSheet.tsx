"use client";
// Diseño común de los reportes y extractos imprimibles (reporte mensual, extractos de órdenes,
// inventario, catálogo de equipos y lista de compra). Mismo estilo que la cotización y la nota
// de venta (DocKit): membrete con banda, tablas con líneas finas. Sigue la opción de impresión
// de Ajustes: blanco y negro, o a color (banda Oscura y detalles en el color Principal).
// Hoja carta. Sirve para páginas React (<RxHero/>, RX_CSS) y para las
// ventanas que se escriben con document.write (rxHeroHtml, rxDocument).
import type { ReactNode } from "react";

export interface RxCompany { companyName: string; slogan?: string | null; logo?: string | null; phone?: string | null; address?: string | null }

export const RX_CSS = `
.rx { --rx-navy:#1e2a3a; --rx-teal:#0e7c86; --rx-mint:#5eead4; --rx-amber:#f59e0b; --rx-ink:#1e2a3a; --rx-muted:#5a6a80; --rx-line:#e2e8f0; --rx-soft:#f1f5f9; --rx-tealsoft:#e6f4f5;
  font-family:"Plus Jakarta Sans","Segoe UI",Arial,sans-serif; color:var(--rx-ink); background:#fff; min-height:100vh; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.rx *, .rx *::before, .rx *::after { box-sizing:border-box; }
.rx-bar { position:fixed; top:0; left:0; right:0; z-index:100; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 12px; padding:10px 20px; background:#1e2a3a; font-family:inherit; }
.rx-bar > span { color:#fff; font-size:14px; font-weight:700; min-width:0; }
.rx-bar > div { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.rx-bar button { display:inline-flex; align-items:center; gap:6px; height:38px; padding:0 16px; border-radius:10px; border:1px solid #475569; background:transparent; color:#e2e8f0; font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; }
.rx-bar button.go { background:#f59e0b; border-color:#f59e0b; color:#422006; }
.rx-bar input, .rx-bar select { height:38px; padding:0 12px; border-radius:10px; border:1px solid #cbd5e1; background:#fff; color:#1e2a3a; font:inherit; font-size:13px; outline:none; }
.rx-page { max-width:1000px; margin:0 auto; padding:78px 28px 40px; display:flex; flex-direction:column; gap:18px; }
.rx-page.wide { max-width:1240px; }
.rx-hero { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; background:var(--rx-navy); color:#fff; border-radius:16px; padding:20px 22px; position:relative; overflow:hidden; }
.rx-brand { display:flex; gap:12px; align-items:center; min-width:0; position:relative; z-index:1; }
.rx-logo { width:48px; height:48px; border-radius:14px; background:var(--rx-teal); display:grid; place-items:center; font-size:24px; flex-shrink:0; overflow:hidden; color:#fff; }
.rx-logo svg { width:55%; height:55%; }
.rx-logo img { width:100%; height:100%; object-fit:contain; background:#fff; }
.rx-co { min-width:0; }
.rx-co b { display:block; font-size:20px; line-height:1.2; }
.rx-co small { display:block; font-size:12px; color:#cbd5e1; margin-top:1px; }
.rx-doc { text-align:right; position:relative; z-index:1; flex-shrink:0; }
.rx-doc > span { display:inline-block; background:var(--rx-amber); color:#422006; font-weight:800; font-size:12px; padding:4px 12px; border-radius:999px; letter-spacing:.04em; }
.rx-doc b { display:block; font-size:22px; color:var(--rx-mint); margin-top:6px; white-space:nowrap; }
.rx-doc small { display:block; font-size:11.5px; color:#cbd5e1; margin-top:2px; }
.rx-kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; }
.rx-kpi { position:relative; border:1px solid var(--rx-line); border-radius:12px; padding:12px 14px 11px; overflow:hidden; min-width:0; background:#fff; }
.rx-kpi span { display:block; font-size:10.5px; font-weight:700; color:var(--rx-muted); text-transform:uppercase; letter-spacing:.05em; }
.rx-kpi b { display:block; font-size:24px; font-weight:800; color:var(--c, #0e7c86); line-height:1.15; margin-top:4px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.rx-kpi small { display:block; font-size:10.5px; color:var(--rx-muted); margin-top:2px; }
.rx-income { background:linear-gradient(120deg, #047857, #047857); color:#fff; border-radius:14px; padding:14px 18px; display:grid; grid-template-columns:1fr auto; gap:8px 18px; align-items:center; }
.rx-income > span { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#bbf7d0; }
.rx-income > b { grid-row:span 2; font-size:30px; line-height:1; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rx-split { display:flex; height:9px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.18); }
.rx-split i { display:block; }
.rx-legend { display:flex; gap:6px 16px; flex-wrap:wrap; font-size:11px; color:#f0fdf4; margin-top:6px; }
.rx-legend i, .rx-chip i { display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
.rx-sect { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--rx-navy); border-bottom:2px solid var(--rx-navy); padding-bottom:5px; margin-bottom:9px; }
.rx-sect em { margin-left:auto; font-style:normal; background:var(--rx-tealsoft); color:var(--rx-teal); border-radius:999px; padding:2px 10px; font-size:11px; letter-spacing:.02em; text-transform:none; }
.rx-stack { display:flex; height:12px; border-radius:999px; overflow:hidden; background:var(--rx-soft); }
.rx-stack i { display:block; }
.rx-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.rx-chip { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; background:var(--rx-soft); font-size:11px; font-weight:700; color:#475569; }
.rx-chip i { border-radius:50%; }
.rx-tech { display:grid; grid-template-columns:28px minmax(90px, 170px) 1fr auto; align-items:center; gap:10px; padding:4px 0; font-size:12px; }
.rx-meter { height:9px; background:var(--rx-soft); border-radius:999px; overflow:hidden; }
.rx-meter i { display:block; height:100%; background:var(--rx-teal); border-radius:999px; }
.rx-tech .n { font-weight:800; color:#047857; white-space:nowrap; font-variant-numeric:tabular-nums; }
.rx-tw { border:1px solid var(--rx-line); border-radius:10px; overflow:hidden; }
table.rx-t { width:100%; border-collapse:collapse; font-size:11px; }
.rx-t th { background:var(--rx-navy); color:#fff; text-align:left; font-weight:700; padding:7px 9px; font-size:10.5px; letter-spacing:.03em; }
.rx-t td { padding:7px 9px; border-top:1px solid var(--rx-line); vertical-align:top; }
.rx-t tbody tr:nth-child(even) td { background:#f8fafc; }
.rx-t .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rx-t .c { text-align:center; }
.rx-t .muted { color:var(--rx-muted); }
.rx-t tfoot td { background:var(--rx-tealsoft) !important; font-weight:800; color:var(--rx-navy); border-top:2px solid var(--rx-teal); }
.rx-code { font-family:ui-monospace, Consolas, monospace; font-weight:700; color:var(--rx-teal); white-space:nowrap; }
.rx-pill { display:inline-block; padding:2px 9px; border-radius:999px; font-weight:700; font-size:10.5px; white-space:nowrap; }
.rx-client { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border:1px solid var(--rx-line); border-radius:14px; padding:14px 16px; }
.rx-av { width:46px; height:46px; border-radius:50%; background:var(--rx-tealsoft); display:grid; place-items:center; font-size:22px; }
.rx-client b { display:block; font-size:18px; }
.rx-client small { display:block; color:var(--rx-muted); font-size:12px; margin-top:2px; }
.rx-client .tot { text-align:right; }
.rx-client .tot b { color:var(--rx-teal); font-variant-numeric:tabular-nums; }
.rx-check { display:inline-block; width:14px; height:14px; border:1.5px solid #94a3b8; border-radius:3px; vertical-align:middle; }
.rx-empty { color:var(--rx-muted); font-style:italic; font-size:12px; }
.rx-note { color:var(--rx-muted); font-size:11px; }
.rx-foot { display:flex; justify-content:space-between; gap:6px 12px; flex-wrap:wrap; color:var(--rx-muted); border-top:1px solid var(--rx-line); padding-top:8px; font-size:10.5px; }
/* Blanco y negro por defecto (impresoras de tóner): banda negra con el nombre y el título,
   sin fondos de color, líneas finas; las barras de colores quedan en grises.
   Con la opción "A color" las variables --doc-* (ver brand-colors.ts) pintan la banda, el logo,
   los números de los recuadros y los títulos de sección. Sin esas variables queda en negro. */
.rx { --rx-navy:#000; --rx-teal:#000; --rx-mint:#000; --rx-ink:#000; --rx-muted:#000; --rx-line:#000; --rx-soft:#fff; --rx-tealsoft:#fff; font-family:"Helvetica Neue",Arial,Helvetica,sans-serif; }
.rx-hero { background:var(--doc-band, #000); color:#fff; border-radius:0; padding:14px 18px; align-items:center; box-shadow:inset 0 -3px 0 var(--doc-stripe, transparent); }
.rx-hero svg, .rx-sect svg { display:none; }
.rx-logo { background:#fff; border-radius:0; }
.rx-logo img { filter:var(--doc-logo-filter, grayscale(1)); }
.rx-co small, .rx-doc small { color:#fff; }
.rx-doc > span { background:none; color:#fff; border-radius:0; padding:0; font-weight:400; font-size:12px; letter-spacing:0; }
.rx-doc b { color:var(--doc-code, #fff); }
.rx-kpi { border:0; border-top:1px solid var(--doc-accent, #000); border-radius:0; padding:8px 0 0; }
.rx-kpi b { color:var(--doc-accent, #000) !important; }
.rx-kpi span, .rx-income > span { text-transform:none; letter-spacing:0; font-weight:400; font-size:11.5px; }
.rx-income { background:#fff; color:#000; border:0; border-top:1.5px solid #000; border-bottom:.5px solid #000; border-radius:0; padding:12px 0; }
.rx-income > span, .rx-legend { color:#000; }
.rx-split { background:#fff; border:.5px solid #000; border-radius:0; }
.rx-split, .rx-stack, .rx-legend i, .rx-chip i, .rx-meter i { filter:grayscale(1); }
.rx-stack, .rx-meter { border:.5px solid #000; border-radius:0; }
.rx-meter i { border-radius:0; }
.rx-sect em { background:none; color:#000; border:0; border-radius:0; padding:0; font-weight:400; }
.rx-sect { text-transform:none; letter-spacing:0; font-size:14px; font-weight:700; border-bottom:1px solid var(--doc-accent, #000); color:var(--doc-accent, #000); }
.rx-chip { background:#fff; color:#000; border:.5px solid #000; border-radius:0; font-weight:400; }
.rx-tech .n { color:#000; }
.rx-tw { border:0; border-radius:0; }
.rx-t th { background:#fff; color:#000; font-weight:400; border-bottom:1px solid #000; }
.rx-t td { border-top:0; border-bottom:.5px solid #999; }
.rx-t tbody tr:nth-child(even) td { background:#fff; }
.rx-t tfoot td { background:#fff !important; color:#000; border-top:1.5px solid #000; border-bottom:0; }
.rx-code { color:#000; }
.rx-pill { background:#fff !important; color:#000 !important; border:.5px solid #000; border-radius:0; font-weight:400; }
.rx-client { border:0; border-top:1px solid #000; border-bottom:.5px solid #000; border-radius:0; padding:12px 0; }
.rx-av { background:#fff; border:.5px solid #000; color:#000; }
.rx-client .tot b { color:#000; }
.rx-check { border-color:#000; border-radius:0; }
/* Colores que vienen escritos en cada reporte (estados, montos, etiquetas): también en negro. */
.rx-page *:not(.no-print, .no-print *, .rx-hero, .rx-hero *, .rx-kpi b, .rx-sect) { color:#000 !important; }
.rx-page [style*="background"]:not(i):not(.no-print, .no-print *) { background:#fff !important; }
@media print {
  .rx-bar, .no-print { display:none !important; }
  .rx { min-height:0; }
  .rx-page { padding:0 !important; max-width:none; gap:14px; }
  .rx-t tr, .rx-kpi, .rx-tech { break-inside:avoid; }
  .rx-t thead { display:table-header-group; }
}
@media screen and (max-width:640px) {
  .rx-bar { position:sticky; padding:10px 12px; }
  .rx-bar > div { width:100%; }
  .rx-bar input { flex:1 1 100%; min-width:0; }
  .rx-page { padding:14px 12px 28px; gap:14px; }
  .rx-hero { flex-direction:column; padding:16px; }
  .rx-doc { text-align:left; }
  .rx-kpis { grid-template-columns:1fr 1fr; gap:8px; }
  .rx-kpi b { font-size:20px; }
  .rx-income { grid-template-columns:1fr; }
  .rx-income > b { grid-row:auto; font-size:26px; }
  .rx-tech { grid-template-columns:24px 1fr auto; row-gap:4px; }
  .rx-tech .rx-meter { grid-column:2 / -1; grid-row:2; }
  .rx-client { grid-template-columns:auto 1fr; }
  .rx-client .tot { grid-column:1 / -1; text-align:left; }
  .rx-tw { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  /* Tablas largas: cada fila como tarjeta (código y monto arriba, el resto debajo) */
  .rx-tw.as-cards { border:0; overflow:visible; }
  .rx-tw.as-cards table, .rx-tw.as-cards tbody, .rx-tw.as-cards tfoot { display:block; }
  .rx-tw.as-cards thead { display:none; }
  .rx-tw.as-cards tr { display:flex; flex-wrap:wrap; align-items:baseline; column-gap:8px; row-gap:3px; padding:10px 12px; margin-bottom:8px; border:1px solid var(--rx-line); border-radius:0; background:#fff; }
  .rx-tw.as-cards tr::after { content:""; flex-basis:100%; order:1; }
  .rx-tw.as-cards td { border:0 !important; padding:0 !important; background:none !important; font-size:12.5px; }
  .rx-tw.as-cards td:first-child { font-size:14px; flex:1 1 auto; }
  .rx-tw.as-cards td:last-child { order:1; margin-left:auto; font-size:14px; }
  .rx-tw.as-cards td:not(:first-child):not(:last-child) { order:2; color:#000; }
  .rx-tw.as-cards td:not(:first-child):not(:last-child) + td:not(:last-child)::before { content:"· "; color:#94a3b8; }
  .rx-tw.as-cards tfoot tr { background:var(--rx-tealsoft); }
}
`;

/** Tamaño de la hoja al imprimir (siempre carta). */
export const rxPageCss = (landscape = false) =>
  `@media print { @page { size: letter ${landscape ? "landscape" : "portrait"}; margin: ${landscape ? "9mm" : "12mm"}; } body { background:#fff !important; } }`;

/** Estado de una orden: nombre, ícono, colores de la etiqueta y color de la barra. */
export const RX_STATUS: Record<string, { label: string; bg: string; fg: string; bar: string }> = {
  pending: { label: "Pendiente", bg: "#fffbeb", fg: "#b45309", bar: "#f59e0b" },
  diagnosed: { label: "Diagnosticado", bg: "#cffafe", fg: "#0e7490", bar: "#06b6d4" },
  waiting_parts: { label: "Esperando repuestos", bg: "#ffedd5", fg: "#c2410c", bar: "#f97316" },
  in_progress: { label: "En progreso", bg: "#dbeafe", fg: "#1d4ed8", bar: "#2563eb" },
  completed: { label: "Listo para recoger", bg: "#f0fdf4", fg: "#047857", bar: "#10b981" },
  delivered: { label: "Entregado", bg: "#f1f5f9", fg: "#475569", bar: "#94a3b8" },
};
export const rxStatus = (s: string) => RX_STATUS[s] || { label: s, bg: "#f1f5f9", fg: "#475569", bar: "#94a3b8" };

export const rxEsc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
/** Bs. con separador de miles (y centavos si se pide). */
export const rxBs = (n: number, cents = false) =>
  `Bs. ${(Number(n) || 0).toLocaleString("es-BO", cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
export const rxNum = (n: number) => (Number(n) || 0).toLocaleString("es-BO");

const contactLine = (s: RxCompany, branch?: string | null) =>
  [branch, s.phone, s.address].filter(Boolean).join(" · ");

/** Banda del encabezado (páginas React). */
export function RxHero({ s, branch, label, title, sub }: { s: RxCompany; branch?: string | null; icon?: ReactNode; label: string; title: ReactNode; sub?: ReactNode }) {
  const line = contactLine(s, branch);
  return (
    <div className="rx-hero">
      <div className="rx-brand">
        {s.logo && <span className="rx-logo"><img src={s.logo} alt="" /></span>}
        <div className="rx-co"><b>{s.companyName}</b>{s.slogan && <small>{s.slogan}</small>}{line && <small>{line}</small>}</div>
      </div>
      <div className="rx-doc"><span>{label}</span><b>{title}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/** Banda del encabezado (ventanas escritas con document.write). Todo el texto se escapa. */
export function rxHeroHtml({ s, branch, label, title, sub }: { s: RxCompany; branch?: string | null; icon?: string; label: string; title: string; sub?: string }) {
  const line = contactLine(s, branch);
  const logo = s.logo ? `<span class="rx-logo"><img src="${rxEsc(s.logo)}" alt=""></span>` : "";
  return `<div class="rx-hero"><div class="rx-brand">${logo}<div class="rx-co"><b>${rxEsc(s.companyName)}</b>${s.slogan ? `<small>${rxEsc(s.slogan)}</small>` : ""}${line ? `<small>${rxEsc(line)}</small>` : ""}</div></div>`
    + `<div class="rx-doc"><span>${rxEsc(label)}</span><b>${rxEsc(title)}</b>${sub ? `<small>${rxEsc(sub)}</small>` : ""}</div></div>`;
}

const DOC_VARS = ["--doc-band", "--doc-accent", "--doc-code", "--doc-stripe", "--doc-logo-filter"];

/** Copia los colores de impresión de esta página (ya resueltos) para la ventana nueva,
 *  que no carga globals.css ni los colores de la marca. */
function docVarsCss() {
  if (typeof window === "undefined") return "";
  const cs = getComputedStyle(document.documentElement);
  const list = DOC_VARS.map((k) => [k, cs.getPropertyValue(k).trim()]).filter(([, v]) => v);
  return list.length ? `:root{${list.map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
}

/** Documento completo para una ventana nueva: barra (Imprimir / Cerrar), hoja y estilos. */
export function rxDocument({ title, barTitle, landscape, wide, body, autoPrint }: { title: string; barTitle: string; landscape?: boolean; wide?: boolean; body: string; autoPrint?: boolean }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${rxEsc(title)}</title>`
    + `<style>html,body{margin:0;background:#fff}${docVarsCss()}${RX_CSS}${rxPageCss(landscape)}</style></head><body><div class="rx">`
    + `<div class="rx-bar"><span>${rxEsc(barTitle)}</span><div><button class="go" onclick="window.print()">Imprimir</button><button onclick="window.close()">Cerrar</button></div></div>`
    + `<div class="rx-page${wide ? " wide" : ""}">${body}</div></div>`
    + (autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>` : "")
    + `</body></html>`;
}

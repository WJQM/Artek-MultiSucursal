"use client";
import { FileSpreadsheet, Printer, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { useEffect, useState } from "react";
import { todayISO } from "@/shared/dates";
import { EXTRACTO_MAX, extractoApiParams, extractoHojas, extractoQuery, type ExtractoFiltros } from "@/shared/extracto";

// Ventana "Imprimir extracto": antes de abrir la hoja cuenta cuántos equipos y hojas salen.
// Si son demasiados no deja imprimir (el navegador se quedaba sin memoria) y ofrece el Excel.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (ymd: string, days: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d); };

function opciones(actuales: ExtractoFiltros) {
  const hoy = todayISO();
  const [y, m] = hoy.split("-").map(Number);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const pasadoIni = iso(new Date(Date.UTC(y, m - 2, 1, 12)));
  const pasadoFin = iso(new Date(Date.UTC(y, m - 1, 0, 12)));
  return [
    { key: "actual", label: "Filtros de la pantalla", f: actuales },
    { key: "mes", label: "Este mes", f: { desde: inicioMes, hasta: hoy } },
    { key: "pasado", label: "Mes pasado", f: { desde: pasadoIni, hasta: pasadoFin } },
    { key: "semana", label: "Últimos 7 días", f: { desde: shift(hoy, -6), hasta: hoy } },
    { key: "taller", label: "Solo en taller", f: { estado: "open" as const } },
  ];
}

export function ExtractoPrintDialog({ actuales, sucursal, onClose }: { actuales: ExtractoFiltros; sucursal?: string; onClose: () => void }) {
  const ops = opciones(actuales);
  const [sel, setSel] = useState("actual");
  const elegido = ops.find(o => o.key === sel) || ops[0];
  const filtros: ExtractoFiltros = { ...elegido.f, sucursal: sucursal || "" };
  const clave = extractoQuery(filtros).toString();
  const [total, setTotal] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setTotal(null); setFallo(false);
    apiFetch(`/api/repairs?${extractoApiParams(filtros)}&count=1`, sucursal ? { headers: { "x-branch-id": sucursal } } : {})
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (vivo) setTotal(Number(d.total) || 0); })
      .catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps -- clave resume los filtros elegidos

  const demasiados = total !== null && total > EXTRACTO_MAX;
  const abrir = () => { window.open(`/extracto/imprimir?${clave}`, "_blank"); onClose(); };

  // Excel de las órdenes del período (la exportación pide fechas: sin fechas, los últimos 3 años)
  const excel = async () => {
    const hoy = todayISO();
    const desde = filtros.desde || shift(hoy, -3 * 365);
    const hasta = filtros.hasta || hoy;
    setBajando(true);
    try {
      const r = await apiFetch(`/api/export/excel?from=${desde}&to=${hasta}&sheets=ordenes`, sucursal ? { headers: { "x-branch-id": sucursal } } : {});
      if (!r.ok) { const d = await r.json().catch(() => ({})); sileo.error({ title: d.error || "No se pudo generar el Excel" }); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "Extracto.xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      sileo.success({ title: "Excel descargado", description: name });
    } catch { sileo.error({ title: "Sin conexión", description: "Revisa tu internet e intenta de nuevo" }); }
    finally { setBajando(false); }
  };

  const chip = (on: boolean) => ({ padding: "7px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(var(--accent-bright-rgb), 0.08)" : "transparent", color: on ? "var(--accent-dim)" : "var(--text-secondary)" });
  const box = (bg: string, fg: string) => ({ padding: "10px 12px", borderRadius: 10, background: bg, color: fg, fontSize: 13, lineHeight: 1.5 });

  return (
    <div role="dialog" aria-modal="true" aria-label="Imprimir extracto" data-esc onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(15,23,42,0.3)", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Imprimir extracto</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={16} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 12px" }}>Elige qué equipos entran en la hoja</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {ops.map(o => <button key={o.key} onClick={() => setSel(o.key)} aria-pressed={sel === o.key} style={chip(sel === o.key)}>{o.label}</button>)}
        </div>
        <div aria-live="polite">
          {fallo ? <div style={box("var(--danger-bg)", "var(--danger)")}>No se pudo contar los equipos. Revisa tu internet e intenta de nuevo.</div>
            : total === null ? <div style={box("var(--bg-tertiary)", "var(--text-muted)")}>Contando equipos…</div>
            : total === 0 ? <div style={box("var(--bg-tertiary)", "var(--text-secondary)")}>No hay equipos con esta opción.</div>
            : demasiados ? <div style={box("var(--warn-bg)", "var(--warn)")}><b>{total.toLocaleString("es-BO")} equipos</b> son unas {extractoHojas(total).toLocaleString("es-BO")} hojas: demasiado para imprimir (máximo {EXTRACTO_MAX.toLocaleString("es-BO")}). Elige un rango más corto o descarga el Excel.</div>
            : <div style={box("var(--ok-bg)", "var(--ok)")}><b>{total.toLocaleString("es-BO")} equipo{total !== 1 ? "s" : ""}</b> · unas {extractoHojas(total).toLocaleString("es-BO")} hoja{extractoHojas(total) !== 1 ? "s" : ""}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button onClick={excel} disabled={bajando} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontWeight: 600, fontSize: 13, cursor: bajando ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><FileSpreadsheet size={16} strokeWidth={STROKE} aria-hidden="true" />{bajando ? "Preparando…" : "Descargar Excel"}</button>
          <button onClick={abrir} disabled={total === null || total === 0 || demasiados || fallo} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: total === null || total === 0 || demasiados || fallo ? 0.5 : 1 }}><Printer size={16} strokeWidth={STROKE} aria-hidden="true" />{demasiados ? "Elige un rango" : "Abrir para imprimir"}</button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "12px 0 0" }}>El Excel trae todas las órdenes del período elegido (sin fechas: los últimos 3 años).</p>
      </div>
    </div>
  );
}

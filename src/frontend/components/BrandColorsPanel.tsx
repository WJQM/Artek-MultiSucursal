"use client";
import { CircleCheck, Palette, Printer, RotateCcw, TriangleAlert } from "@/frontend/components/icons";
import { coloresDeFoto } from "@/frontend/lib/colores-foto";
import { STROKE } from "@/frontend/components/UiIcons";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { useState } from "react";
import { BRAND_DEFAULT, BRAND_PRESETS, brandCss, brandVars, isHexColor, normalizeBrand, type BrandColors, type PrintMode } from "@/shared/brand-colors";

// Configuración › Colores: estilos listos, dos colores a elección y una vista previa antes de guardar.
// Se aplica al sistema y al portal; los documentos impresos van en blanco y negro o a color, según se elija.

/** Pone los colores en toda la página abierta (sin recargar) */
function aplicarEnPagina(c: BrandColors) {
  let el = document.getElementById("brand-colors");
  if (!el) { el = document.createElement("style"); el.id = "brand-colors"; document.body.prepend(el); }
  el.textContent = brandCss(c);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", normalizeBrand(c).dark));
}

const sameColors = (a: BrandColors, b: BrandColors) => a.accent.toLowerCase() === b.accent.toLowerCase() && a.dark.toLowerCase() === b.dark.toLowerCase();
const same = (a: BrandColors, b: BrandColors) => sameColors(a, b) && (a.print || "bw") === (b.print || "bw");
const ORIGINAL: BrandColors = { ...BRAND_DEFAULT, print: "bw" };

export default function BrandColorsPanel({ initial, onSaved, cover }: { initial: BrandColors; onSaved?: (c: BrandColors) => void; cover?: string | null }) {
  const [saved, setSaved] = useState<BrandColors>(initial);
  const [c, setC] = useState<BrandColors>(initial);
  const [saving, setSaving] = useState(false);
  const [leyendo, setLeyendo] = useState(false);

  const tomarDeFoto = async () => {
    if (!cover) return;
    setLeyendo(true);
    try {
      const r = await coloresDeFoto(cover);
      if (!r) { sileo.error({ title: "No se pudo leer la foto de portada" }); return; }
      setC((x) => ({ ...x, dark: r.dark, accent: r.accent || x.accent }));
      sileo.success({ title: "Colores tomados de la foto", description: r.accent ? "Revisa la vista previa y presiona Guardar" : "La foto no tiene un color vivo: se cambió solo el Oscuro" });
    } finally { setLeyendo(false); }
  };
  const n = normalizeBrand(c);
  const vars = brandVars(c) as React.CSSProperties;
  const cambiado = !same(c, saved);

  const guardar = async () => {
    setSaving(true);
    try {
      const r = await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ brandColors: c }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudieron guardar los colores" }); return; }
      setSaved(c);
      aplicarEnPagina(c);
      onSaved?.(c);
      sileo.success({ title: "Colores guardados", description: "Ya se ven en el sistema, el portal y los documentos" });
    } catch { sileo.error({ title: "Sin conexión", description: "Revisa tu internet e intenta de nuevo" }); }
    finally { setSaving(false); }
  };

  const card: React.CSSProperties = { padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", display: "block", marginBottom: 4 };

  const picker = (k: "accent" | "dark", title: string, help: string, adjusted: boolean, efectivo: string) => (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>{help}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="color" aria-label={`Color ${title}`} value={c[k]} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.value }))}
          style={{ width: 46, height: 40, padding: 2, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", cursor: "pointer", flexShrink: 0 }} />
        <HexInput value={c[k]} label={title} onChange={(v) => setC((x) => ({ ...x, [k]: v }))} />
      </div>
      {adjusted && (
        <div role="status" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--warn-bg)", color: "var(--warn)", fontSize: 12, lineHeight: 1.45 }}>
          <TriangleAlert size={15} strokeWidth={STROKE} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Este color es muy claro: se usará un poco más oscuro <span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: efectivo, verticalAlign: -1, border: "1px solid rgba(0,0,0,.15)" }} /> {efectivo} para que las letras blancas se lean.</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={card}>
        <span style={label}>Estilos listos</span>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Toca uno para probarlo. Puedes ajustarlo después con los colores de abajo.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {BRAND_PRESETS.map((p) => {
            const on = sameColors(c, p);
            return (
              <button key={p.key} type="button" onClick={() => setC((x) => ({ ...x, accent: p.accent, dark: p.dark }))} aria-pressed={on}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${on ? "var(--text-primary)" : "var(--border)"}`, background: "var(--bg-card)", color: "var(--text-primary)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                <span aria-hidden="true" style={{ display: "flex", flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(15,23,42,.08)" }}>
                  <span style={{ width: 16, height: 28, background: p.dark }} /><span style={{ width: 16, height: 28, background: p.accent }} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{p.label}</span>
                {on && <CircleCheck size={16} strokeWidth={STROKE} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {cover && (
          <button type="button" onClick={tomarDeFoto} disabled={leyendo}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: leyendo ? "wait" : "pointer" }}>
            <Palette size={16} strokeWidth={STROKE} aria-hidden="true" /> {leyendo ? "Leyendo la foto…" : "Tomar colores de la foto de portada"}
          </button>
        )}
      </div>

      <div style={card}>
        <span style={label}>Tus colores</span>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
          {picker("accent", "Principal", "Botones, enlaces y pestañas activas", n.accentAdjusted, n.accent)}
          {picker("dark", "Oscuro", "Menú del costado, barra de arriba y portada", n.darkAdjusted, n.dark)}
        </div>
      </div>

      <div style={card}>
        <span style={label}>Vista previa</span>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Así se verá antes de guardar.</p>
        <Preview vars={vars} />
      </div>

      <div style={card}>
        <span style={label}>Documentos impresos</span>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Fichas, órdenes, comprobantes, cotizaciones, certificados, extracto y etiquetas QR.</p>
        <div role="radiogroup" aria-label="Documentos impresos" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {([["bw", "Blanco y negro", "Ahorra tinta. Ideal para impresoras de tóner."], ["color", "A color", "La banda usa el Oscuro y los detalles el Principal."]] as [PrintMode, string, string][]).map(([k, t, d]) => {
            const on = (c.print || "bw") === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setC((x) => ({ ...x, print: k }))}
                style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, border: `1.5px solid ${on ? "var(--text-primary)" : "var(--border)"}`, background: "var(--bg-card)", color: "var(--text-primary)", font: "inherit", textAlign: "left", cursor: "pointer" }}>
                <DocMini vars={vars} color={k === "color"} />
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>{on ? <CircleCheck size={15} strokeWidth={STROKE} aria-hidden="true" /> : <Printer size={15} strokeWidth={STROKE} aria-hidden="true" />}{t}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
        <button type="button" onClick={() => setC(ORIGINAL)} disabled={same(c, ORIGINAL)}
          style={{ padding: "14px 18px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: same(c, ORIGINAL) ? "not-allowed" : "pointer", opacity: same(c, ORIGINAL) ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RotateCcw size={15} strokeWidth={STROKE} aria-hidden="true" /> Volver a los originales
        </button>
        <button type="button" onClick={guardar} disabled={saving || !cambiado}
          style={{ flex: 1, minWidth: 180, padding: 14, background: saving || !cambiado ? "var(--bg-tertiary)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", borderRadius: 12, color: saving || !cambiado ? "var(--text-muted)" : "#fff", fontSize: 14, fontWeight: 700, cursor: saving || !cambiado ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando…" : cambiado ? "Guardar colores" : "Colores guardados"}
        </button>
      </div>
    </>
  );
}

/** Campo "#rrggbb": acepta lo que se escribe y solo cambia el color cuando es válido */
function HexInput({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const [txt, setTxt] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); setTxt(value); }
  return (
    <input aria-label={`Código del color ${label}`} value={txt} maxLength={7} spellCheck={false}
      onChange={(e) => { let v = e.target.value.trim(); if (v && !v.startsWith("#")) v = "#" + v; setTxt(v); if (isHexColor(v)) onChange(v.toLowerCase()); }}
      onBlur={() => setTxt(value)}
      style={{ width: 110, padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, fontFamily: "ui-monospace, monospace", outline: "none" }} />
  );
}

/** Mini sistema y mini portal con los colores elegidos (variables CSS solo dentro de esta caja) */
function Preview({ vars }: { vars: React.CSSProperties }) {
  const item = (t: string, on = false) => (
    <div style={{ padding: "6px 8px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: on ? "rgba(var(--accent-bright-rgb), 0.16)" : "transparent", color: on ? "var(--accent-on-dark)" : "rgba(255,255,255,.62)" }}>{t}</div>
  );
  return (
    <div style={{ ...vars, display: "flex", gap: 12, flexWrap: "wrap" }}>
      {/* Sistema */}
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", minHeight: 190 }}>
        <div style={{ width: 92, flexShrink: 0, background: "var(--brand-dark)", padding: "10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", padding: "2px 8px 8px" }}>Taller</div>
          {item("Panel", true)}{item("Órdenes")}{item("Clientes")}{item("Caja")}
        </div>
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 30, background: "var(--brand-dark)", borderBottom: "1px solid rgba(255,255,255,.08)" }} />
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}>Hoy</span>
              <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Semana</span>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11.5 }}>
              <b style={{ display: "block", fontSize: 12 }}>OT-1024 · Laptop HP</b>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>Ver seguimiento</span>
            </div>
            <span style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 11.5, fontWeight: 700 }}>＋ Nueva orden</span>
          </div>
        </div>
      </div>
      {/* Portal */}
      <div style={{ flex: "1 1 220px", minWidth: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "var(--brand-dark)", padding: "16px 14px", flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-on-dark)" }}>Portal de clientes</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.25, margin: "4px 0 10px" }}>Mira el avance de tu equipo</div>
          <span style={{ display: "inline-block", padding: "7px 12px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700 }}>Buscar mi orden</span>
        </div>
        <div style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--text-secondary)" }}>Novedades · <span style={{ color: "var(--accent)", fontWeight: 700 }}>Ver catálogo</span></div>
      </div>
    </div>
  );
}

/** Encabezado de documento en miniatura: banda negra o con los colores elegidos */
function DocMini({ vars, color }: { vars: React.CSSProperties; color: boolean }) {
  const band = color ? "var(--brand-dark)" : "#000";
  const acc = color ? "var(--accent)" : "#000";
  return (
    <div aria-hidden="true" style={{ ...vars, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "#000" }}>
      <div style={{ background: band, color: "#fff", padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: color ? "inset 0 -3px 0 var(--accent)" : "none", fontSize: 10.5 }}>
        <b>Tu taller</b><b style={{ color: color ? "var(--accent-on-dark)" : "#fff" }}>EQ-1</b>
      </div>
      <div style={{ borderTop: `1.5px solid ${acc}`, marginTop: 8, paddingTop: 3, fontSize: 9.5, fontWeight: 700, color: acc }}>Precio</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Bs. 8.900</div>
    </div>
  );
}

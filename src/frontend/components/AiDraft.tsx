"use client";
import { Banknote } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";

/**
 * "Redactar con IA": toma las notas rápidas del técnico y propone un texto claro para el cliente.
 * No se guarda nada hasta que la persona pulsa "Usar este texto" (y luego registra como siempre).
 * En diagnóstico y repuestos muestra también el precio de reparaciones parecidas ya entregadas.
 */

let readyCache: Promise<boolean> | null = null;
const isReady = () => (readyCache ??= apiFetch("/api/ai/draft").then((r) => (r.ok ? r.json() : { ready: false })).then((d) => !!d.ready).catch(() => false));

interface Price { min: number; max: number; median: number; count: number; examples: { code: string; label: string; cost: number }[] }

export function AiDraft({ repairId, stage, text, onUse }: { repairId: string; stage: string; text: string; onUse: (t: string) => void }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; price: Price | null } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { let on = true; isReady().then((r) => on && setReady(r)); return () => { on = false; }; }, []);
  if (!ready) return null;

  const run = async (short = false) => {
    setBusy(true); setError("");
    try {
      const r = await apiFetch("/api/ai/draft", { method: "POST", body: JSON.stringify({ repairId, stage, notes: text, short, previous: short ? result?.text : undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo redactar"); return; }
      setResult((p) => ({ text: d.text, price: d.price ?? p?.price ?? null }));
    } catch { setError("Sin conexión"); } finally { setBusy(false); }
  };

  const bs = (n: number) => `Bs. ${n.toLocaleString("es-BO")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!result && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => run()} disabled={busy}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(var(--accent-rgb), 0.35)", background: "rgba(var(--accent-rgb), 0.10)", color: "var(--accent-dim)", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Redactando…" : "Redactar con IA"}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{text.trim() ? "Usa tus notas de arriba y las deja claras para el cliente." : "Escribe primero tus notas rápidas (ej.: “pin carga sulfatado, limpiar y cambiar”)."}</span>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-line)", borderRadius: 8, padding: "7px 10px" }}>{error}</div>}
      {result && (
        <div style={{ border: "1.5px solid rgba(var(--accent-rgb), 0.30)", background: "#f4fafa", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.4 }}>Propuesta de la IA · revísala antes de usarla</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap", opacity: busy ? 0.5 : 1 }}>{result.text}</div>
          {result.price && (
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", background: "#fff", border: "1px solid #d7dee8", borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 }}>
              <Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Reparaciones parecidas cobraron <b>{result.price.min === result.price.max ? bs(result.price.min) : `${bs(result.price.min)} – ${bs(result.price.max)}`}</b> (normalmente {bs(result.price.median)}, {result.price.count} casos en esta sucursal).
              <div style={{ color: "var(--text-muted)", marginTop: 3 }}>{result.price.examples.map((e) => `${e.code}: ${bs(e.cost)}`).join(" · ")}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => { onUse(result.text); setResult(null); }} style={b("var(--accent)", true)}>✓ Usar este texto</button>
            <button type="button" disabled={busy} onClick={() => run(true)} style={b("var(--accent)")}>{busy ? "…" : "Más corto"}</button>
            <button type="button" disabled={busy} onClick={() => run()} style={b("#5a6a80")}>Otra versión</button>
            <button type="button" disabled={busy} onClick={() => { setResult(null); setError(""); }} style={b("#5a6a80")}>Descartar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const b = (color: string, solid = false): React.CSSProperties => ({ padding: "7px 11px", borderRadius: 8, border: `1px solid ${color}55`, background: solid ? color : `${color}10`, color: solid ? "#fff" : color, fontSize: 11.5, fontWeight: 700, cursor: "pointer" });

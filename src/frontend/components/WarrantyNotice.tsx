"use client";
import { RotateCcw, ShieldCheck } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Al registrar una OT: avisa si el cliente (por su celular) tiene un equipo entregado que sigue en garantía.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";

export interface WarrantyHit {
  id: string; code: string; device: string; brand: string | null; model: string | null; issue: string;
  estimatedCost: number; deliveredAt: string; until: string; daysLeft: number; clientName: string | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(/\./g, "");

export default function WarrantyNotice({ phone, picked, onPick }: { phone: string; picked: WarrantyHit | null; onPick: (h: WarrantyHit | null) => void }) {
  const [hits, setHits] = useState<WarrantyHit[]>([]);
  const [dismissed, setDismissed] = useState("");
  const digits = phone.replace(/\D/g, "");

  useEffect(() => {
    if (digits.length < 7) return;
    let alive = true;
    const t = setTimeout(() => {
      apiFetch(`/api/repairs/warranty?phone=${encodeURIComponent(digits)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => { if (alive) setHits(d.items || []); })
        .catch(() => {});
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [digits]);

  const visible = digits.length >= 7 ? hits : [];

  if (picked) {
    return (
      <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--warn-bg)", border: "1.5px solid var(--warn-line)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}><RotateCcw size={18} strokeWidth={STROKE} aria-hidden="true" /></span>
        <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: "var(--warn)" }}>
          <b>Reingreso por garantía de {picked.code}</b> — {[picked.device, picked.brand, picked.model].filter(Boolean).join(" ")}. Garantía hasta el {fmt(picked.until)}.
        </div>
        <button type="button" onClick={() => onPick(null)} style={{ padding: "6px 10px", background: "#fff", border: "1px solid var(--warn-line)", borderRadius: 8, color: "var(--warn)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Quitar</button>
      </div>
    );
  }
  if (!visible.length || dismissed === digits) return null;

  return (
    <div className="rt-pop" style={{ marginTop: 14, padding: 16, background: "var(--warn-bg)", border: "1.5px solid var(--warn-line)", borderRadius: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--warn)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}><ShieldCheck size={20} strokeWidth={STROKE} aria-hidden="true" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--warn)" }}>{visible.length === 1 ? "Este cliente tiene un equipo en garantía" : `Este cliente tiene ${visible.length} equipos en garantía`}</div>
          {visible.map((h) => (
            <div key={h.id} style={{ marginTop: 10, background: "#fff", border: "1px solid var(--warn-line)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12.5, color: "var(--accent-dim)", background: "rgba(var(--accent-bright-rgb), 0.1)", padding: "2px 8px", borderRadius: 6 }}>{h.code}</span>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{[h.device, h.brand, h.model].filter(Boolean).join(" · ")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Entregado {fmt(h.deliveredAt)}{h.issue ? ` · “${h.issue.length > 50 ? h.issue.slice(0, 48) + "…" : h.issue}”` : ""} · Bs. {Math.round(h.estimatedCost || 0)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ok)" }}>Hasta {fmt(h.until)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{h.daysLeft === 1 ? "queda 1 día" : `quedan ${h.daysLeft} días`}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onPick(h)} style={{ padding: "8px 12px", background: "var(--warn)", border: "none", borderRadius: 9, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><RotateCcw size={14} strokeWidth={STROKE} aria-hidden="true" /> Es un reingreso por garantía</button>
                <a href={`/delivery/view/${encodeURIComponent(h.code)}`} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 12px", background: "#fff", border: "1px solid #d6dce8", borderRadius: 9, color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver {h.code}</a>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--warn)" }}>Si es reingreso: la nueva OT queda unida a la original, con costo Bs. 0 y la etiqueta <b>GARANTÍA</b>.</span>
            <button type="button" onClick={() => setDismissed(digits)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid var(--warn-line)", borderRadius: 8, color: "var(--warn)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Es otro equipo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { Nut, Search } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useState } from "react";

/**
 * Repuestos usados en una orden, con cantidad.
 * value: lista de ids (un id repetido = varias unidades). El stock lo descuenta el servidor al guardar,
 * solo por la diferencia con lo que la orden ya tenía.
 */
export interface PickItem { id: string; name: string; price: number; cost?: number; quantity: number; minStock: number; category?: string | null }

export const countIds = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => { m[id] = (m[id] || 0) + 1; return m; }, {});
export const partsPayload = (ids: string[]) => Object.entries(countIds(ids)).map(([itemId, qty]) => ({ itemId, qty }));

export function PartsPicker({ items, value, onChange, original = [], title = "Repuestos usados", compact = false }: {
  items: PickItem[]; value: string[]; onChange: (ids: string[]) => void; original?: string[]; title?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const counts = countIds(value);
  const orig = countIds(original);
  const max = (it: PickItem) => it.quantity + (orig[it.id] || 0);
  const setQty = (id: string, n: number) => {
    const it = items.find((i) => i.id === id);
    const lim = it ? max(it) : n;
    const qty = Math.max(0, Math.min(n, lim));
    onChange([...value.filter((x) => x !== id), ...Array(qty).fill(id)]);
  };
  const chosen = Object.keys(counts).map((id) => ({ id, qty: counts[id], it: items.find((i) => i.id === id) })).filter((x) => x.it);
  const total = chosen.reduce((a, x) => a + (x.it!.price || 0) * x.qty, 0);
  const list = items.filter((it) => (max(it) > 0 || counts[it.id]) && (!q || it.name.toLowerCase().includes(q.toLowerCase()) || (it.category || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <section className="ox-sec" style={{ gridColumn: "1 / -1", marginBottom: compact ? 20 : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ox-e" aria-hidden="true"><Nut size={18} strokeWidth={STROKE} aria-hidden="true" /></span>{title} {value.length > 0 && <span className="ui-count">{value.length}</span>}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="ui-btn ui-btn-secondary" style={{ minHeight: 38, fontSize: 13.5 }}>{open ? "✓ Listo" : "＋ Agregar repuesto"}</button>
      </div>

      {chosen.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {chosen.map(({ id, qty, it }) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#fff", border: "1px solid var(--border-light)", borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{it!.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Bs. {it!.price} c/u · quedan {max(it!) - qty}</div>
              </div>
              <button type="button" aria-label="Uno menos" onClick={() => setQty(id, qty - 1)} style={qb}>−</button>
              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{qty}</span>
              <button type="button" aria-label="Uno más" disabled={qty >= max(it!)} onClick={() => setQty(id, qty + 1)} style={{ ...qb, opacity: qty >= max(it!) ? 0.4 : 1 }}>＋</button>
              <span className="tabular" style={{ width: 72, textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Bs. {Math.round(it!.price * qty * 100) / 100}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>Repuestos: <b>Bs. {Math.round(total * 100) / 100}</b> · el stock se descuenta al guardar</div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="ox-search"><span aria-hidden="true"><Search size={14} strokeWidth={STROKE} aria-hidden="true" /></span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar repuesto" aria-label="Buscar repuesto" /></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflow: "auto" }}>
            {list.map((it) => {
              const n = counts[it.id] || 0;
              return (
                <button type="button" key={it.id} onClick={() => setQty(it.id, n ? 0 : 1)}
                  style={{ flex: "1 1 160px", textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: `${n ? 2 : 1}px solid ${n ? "var(--accent)" : "var(--border)"}`, background: n ? "var(--accent-subtle)" : "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{n ? "✓ " : ""}{it.name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 11.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Bs. {it.price}</span>
                    <span style={{ color: it.quantity <= it.minStock ? "var(--danger)" : "var(--text-muted)" }}>Stock: {it.quantity}</span>
                  </div>
                </button>
              );
            })}
            {!list.length && <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 11 }}>No hay repuestos con stock</div>}
          </div>
        </div>
      )}
    </section>
  );
}

const qb: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

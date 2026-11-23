"use client";
import { X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/frontend/lib/api";

/** Movimientos de stock de un producto: ventas, órdenes, ajustes manuales, traspasos… con quién y cuándo. */
interface Row { id: string; delta: number; after: number; label: string; refCode: string | null; userName: string | null; createdAt: string }

export function StockHistory({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [data, setData] = useState<{ name: string; quantity: number; items: Row[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch(`/api/inventory/movements?itemId=${encodeURIComponent(itemId)}`).then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok) setData(d); else setError(d.error || "No se pudo cargar"); }).catch(() => setError("Sin conexión"));
  }, [itemId]);
  if (typeof document === "undefined") return null;
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return createPortal(
    <div data-esc role="dialog" aria-modal="true" aria-label="Movimientos de stock" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 24px)", overflowY: "auto", background: "#fff", borderRadius: 16 }}>
        <div style={{ padding: "14px 18px", background: "var(--brand-dark)", color: "#fff", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Movimientos de stock</div>
            <div style={{ fontSize: 11.5, opacity: 0.8 }}>{data ? `${data.name} · hay ${data.quantity}` : "Cargando…"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
        <div style={{ padding: 14 }}>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          {data && !data.items.length && <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Todavía no hay movimientos registrados. Desde ahora se anota cada venta, orden y ajuste.</div>}
          {data && data.items.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 4px", borderBottom: "1px solid var(--bg-hover)" }}>
              <div style={{ width: 48, textAlign: "right", fontWeight: 700, fontSize: 15, color: r.delta < 0 ? "var(--danger-bright)" : "var(--ok)", flexShrink: 0 }}>{r.delta > 0 ? `+${r.delta}` : r.delta}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{r.label}{r.refCode ? ` ${r.refCode}` : ""}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(r.createdAt)}{r.userName ? ` · ${r.userName}` : ""}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>queda <b>{r.after}</b></div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

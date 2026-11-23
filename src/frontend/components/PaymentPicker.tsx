"use client";
import { Maximize2 } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Cobro: Efectivo o QR. Con QR muestra el QR del taller con el monto y una vista grande para el cliente.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";

export type PayMethod = "cash" | "qr";
interface Qr { image: string; bank: string; holder: string }

let cache: Qr | null = null;
export function usePaymentQr() {
  const [qr, setQr] = useState<Qr | null>(cache);
  useEffect(() => {
    if (cache) return;
    apiFetch("/api/payments").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { cache = d; setQr(d); } }).catch(() => {});
  }, []);
  return qr;
}
export function invalidatePaymentQr() { cache = null; }

const fmt = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

export default function PaymentPicker({ amount, value, onChange, reference, compact }: {
  amount: number; value: PayMethod | null; onChange: (m: PayMethod) => void; reference?: string; compact?: boolean;
}) {
  const qr = usePaymentQr();
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!big) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [big]);

  const opt = (m: PayMethod, label: string) => {
    const on = value === m;
    return (
      <button type="button" onClick={() => onChange(m)} aria-pressed={on}
        style={{ flex: 1, minHeight: compact ? 40 : 44, padding: "0 10px", borderRadius: 10, border: `${on ? 2 : 1}px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-subtle)" : "var(--bg-card)", color: on ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 14, fontWeight: on ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background-color 150ms ease, border-color 150ms ease" }}>
        {label}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {opt("cash", "Efectivo")}
        {opt("qr", "QR")}
      </div>

      {value === "qr" && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {qr?.image ? (
            <button type="button" onClick={() => setBig(true)} title="Mostrar al cliente" style={{ border: "none", padding: 0, background: "#fff", borderRadius: 10, cursor: "zoom-in", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
              { }
              <img src={qr.image} alt="QR de cobro" width={92} height={92} style={{ display: "block", width: 92, height: 92, objectFit: "contain", borderRadius: 10 }} />
            </button>
          ) : null}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)" }}>Cobrar por QR</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1e1b4b", fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</div>
            {qr?.image ? (
              <>
                {(qr.bank || qr.holder) && <div style={{ fontSize: 11.5, color: "#4b5563" }}>{[qr.bank, qr.holder].filter(Boolean).join(" · ")}</div>}
                <button type="button" onClick={() => setBig(true)} style={{ marginTop: 6, padding: "7px 12px", borderRadius: 9, border: "none", background: "var(--info-bright)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Maximize2 size={13} strokeWidth={STROKE} aria-hidden="true" /> Mostrar al cliente</button>
              </>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>Aún no se subió el QR del taller (Configuración › Tareas automáticas › Cobro con QR). Igual se registra como pagado por QR.</div>
            )}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Confirma en tu app del banco que el pago llegó.</div>
          </div>
        </div>
      )}

      {big && qr?.image && (
        <div role="dialog" aria-modal="true" aria-label="QR de cobro" onClick={() => setBig(false)}
          style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "24px 16px", textAlign: "center", color: "var(--text-primary)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>Escanea con la app de tu banco</div>
          { }
          <img src={qr.image} alt="QR de cobro" style={{ width: "min(78vw, 62vh)", height: "auto", maxWidth: 520 }} />
          <div style={{ fontSize: "clamp(34px, 9vw, 64px)", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{fmt(amount)}</div>
          {reference && <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>Concepto: <b>{reference}</b></div>}
          {(qr.bank || qr.holder) && <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{[qr.bank, qr.holder].filter(Boolean).join(" · ")}</div>}
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>Toca en cualquier lugar para cerrar</div>
        </div>
      )}
    </div>
  );
}

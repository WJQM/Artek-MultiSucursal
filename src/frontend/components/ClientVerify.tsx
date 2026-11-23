"use client";
import { errMsg } from "@/shared/errors";
import { useState } from "react";
import { requestPass } from "@/frontend/lib/track-client";
import { Lock } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

/** Tarjeta "Datos protegidos": el cliente ingresa los últimos 4 dígitos de su celular */
export function ClientVerify({ code, repairId, maskedPhone, canVerify, purpose, onVerified }: {
  code: string; repairId: string; maskedPhone?: string | null; canVerify?: boolean;
  purpose: string; onVerified: (token: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.length !== 4) { setError("Ingresa los 4 dígitos"); return; }
    setBusy(true); setError("");
    try { onVerified(await requestPass(code, repairId, digits)); setDigits(""); }
    catch (err) { setError(errMsg(err) || "No se pudo verificar"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "2px dashed var(--text-muted)", fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ color: "var(--text-secondary)", display: "flex" }}><Lock size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Datos del cliente protegidos</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
            {canVerify
              ? `¿Eres el cliente? Ingresa los últimos 4 dígitos del celular registrado${maskedPhone ? ` (${maskedPhone})` : ""} para ${purpose}.`
              : "Para ver el detalle de esta orden, consulta directamente en la tienda."}
          </div>
        </div>
      </div>
      {canVerify && (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={digits} onChange={(e) => { setDigits(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
            inputMode="numeric" autoComplete="off" placeholder="• • • •" aria-label="Últimos 4 dígitos del celular"
            style={{ flex: 1, minWidth: 0, padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 18, letterSpacing: 8, textAlign: "center", fontWeight: 800, fontFamily: "monospace", outline: "none", background: "var(--bg-tertiary)" }} />
          <button type="submit" disabled={busy || digits.length !== 4}
            style={{ flexShrink: 0, padding: "11px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 800, color: "#fff", cursor: busy ? "wait" : "pointer", background: digits.length === 4 ? "linear-gradient(135deg,var(--accent-dim),var(--accent))" : "var(--text-muted)" }}>
            {busy ? "..." : "Ver mis datos"}
          </button>
        </form>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger-bright)" }}>{error}</div>}
    </div>
  );
}

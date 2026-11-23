"use client";
import { Smartphone } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Enviar una cotización o nota de venta por WhatsApp: desde el número del taller o abriendo WhatsApp.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { waLink } from "@/frontend/components/ReceiptShare";

export default function QuotationWhatsApp({ id, code, isQuot, defaultPhone }: { id: string; code: string; isQuot: boolean; defaultPhone?: string | null }) {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [showMsg, setShowMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/quotations/whatsapp?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d) return;
      setMessage(d.message || "");
      if (!defaultPhone && d.phone) setPhone(d.phone);
    }).catch(() => {});
    return () => { alive = false; };
  }, [id, defaultPhone]);

  const digits = phone.replace(/\D/g, "");
  const okPhone = digits.length >= 8;
  const wa = okPhone && message ? waLink(phone, message) : null;

  const send = async () => {
    if (!okPhone) { sileo.warning({ title: "Escribe el celular del cliente", description: "Ej: 70012345" }); return; }
    setBusy(true); setFailed(null);
    try {
      const r = await apiFetch("/api/quotations/whatsapp", { method: "POST", body: JSON.stringify({ id, phone }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.sent) { setSent(true); sileo.success({ title: `${isQuot ? "Cotización" : "Nota de venta"} enviada por WhatsApp`, description: `${code} a ${phone}` }); }
      else { setFailed(d.error || "No se pudo enviar desde el número del taller"); sileo.warning({ title: "No se envió desde el número del taller", description: "Usa “Abrir WhatsApp” para enviarlo tú" }); }
    } catch { setFailed("Sin conexión"); }
    finally { setBusy(false); }
  };

  return (
    <div className="qwa">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 180px", minWidth: 0, display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
          <span style={{ padding: "0 4px 0 12px", display: "flex", color: "var(--text-muted)" }} aria-hidden="true"><Smartphone size={16} strokeWidth={STROKE} /></span>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSent(false); }} placeholder="Celular del cliente" aria-label="Celular del cliente"
            style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 6px", border: "none", fontSize: 14, fontFamily: "inherit", outline: "none", background: "transparent", color: "var(--text-primary)" }} />
        </div>
        <button type="button" onClick={send} disabled={busy || !message}
          style={{ padding: "10px 16px", background: sent ? "var(--ok)" : "#25d366", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap" }}>
          {busy ? "Enviando…" : sent ? "✓ Enviado" : "Enviar"}
        </button>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            style={{ padding: "10px 14px", background: failed ? "var(--ok-bg)" : "#fff", border: `1px ${failed ? "dashed var(--ok)" : "solid var(--border)"}`, borderRadius: 10, color: "var(--ok)", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            Abrir WhatsApp
          </a>
        )}
      </div>
      {failed && <div style={{ marginTop: 8, fontSize: 12, color: "var(--warn)" }}>{failed}. Toca <b>Abrir WhatsApp</b> para enviarlo desde tu celular.</div>}
      <button type="button" onClick={() => setShowMsg((v) => !v)} style={{ marginTop: 8, padding: 0, border: "none", background: "none", color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        {showMsg ? "Ocultar mensaje" : "Ver el mensaje que se enviará"}
      </button>
      {showMsg && (
        <pre style={{ marginTop: 6, padding: "10px 12px", background: "var(--ok-bg)", border: "1px solid var(--ok-line)", borderRadius: 10, fontSize: 12, lineHeight: 1.45, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#14532d", maxHeight: 220, overflow: "auto" }}>{message || "Cargando…"}</pre>
      )}
    </div>
  );
}

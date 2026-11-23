"use client";
import { X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Comprobante de entrega digital: enviarlo por WhatsApp o copiar el enlace personal del cliente.
import { useEffect, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import EmailSend from "@/frontend/components/EmailSend";
import { showCopy } from "@/frontend/lib/dialog";

interface Receipt { url: string; message: string; ceCode: string; phone: string | null; clientName: string | null; email?: string | null }

/** Enlace para abrir WhatsApp con el mensaje listo (8 dígitos → 591…).
 *  Se usa api.whatsapp.com/send y no wa.me: wa.me daña algunos emojis (👋 💰 → "�") en WhatsApp de computadora. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.length === 8 ? `591${d}` : d;
  return `https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(text)}`;
}

const mask = (p?: string | null) => { const d = (p || "").replace(/\D/g, ""); return d.length > 4 ? `••••${d.slice(-4)}` : d; };

// Opciones en lista sobria: borde neutro; la opción destacada (ya enviado) usa el acento del sistema.
const optStyle = (strong = false): React.CSSProperties => ({
  padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${strong ? "var(--accent)" : "var(--border)"}`,
  background: strong ? "var(--accent-subtle)" : "#fff", display: "flex", alignItems: "center", gap: 12, width: "100%",
  textAlign: "left", fontFamily: "inherit", color: "inherit", textDecoration: "none",
});
// Los íconos-emoji de cada opción se ocultan: el texto ya dice qué hace

export default function ReceiptShare({ code, sentOnDelivery }: { code: string; sentOnDelivery?: boolean | null }) {
  const [rc, setRc] = useState<Receipt | null>(null);
  const [sent, setSent] = useState<boolean | null>(sentOnDelivery ?? null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/receipt?code=${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setRc(d); }).catch(() => {});
    return () => { alive = false; };
  }, [code]);

  const send = async () => {
    setSending(true); setFailed(false);
    try {
      const r = await apiFetch("/api/receipt", { method: "POST", body: JSON.stringify({ code }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.sent) { setSent(true); sileo.success({ title: `Comprobante enviado por WhatsApp`, description: `${d.ceCode} a ${mask(d.phone)}` }); }
      else { setFailed(true); sileo.warning({ title: d.error || "No se pudo enviar desde el número del taller", description: d.error ? undefined : "Usa “Abrir WhatsApp” para enviarlo tú" }); }
    } catch { setFailed(true); }
    finally { setSending(false); }
  };

  const copy = async () => {
    if (!rc) return;
    try { await navigator.clipboard.writeText(rc.url); sileo.success({ title: "Enlace copiado", description: "Pégalo donde quieras enviarlo" }); }
    catch { showCopy("Copia el enlace:", rc.url); }
  };

  const wa = rc ? waLink(rc.phone, rc.message) : null;
  const hasPhone = !!rc?.phone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sent === true ? (
        <div style={{ ...optStyle(true), cursor: "default" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Enviado por WhatsApp</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Le llegó el comprobante{rc?.phone ? ` a ${mask(rc.phone)}` : ""}</div>
          </div>
          <button type="button" onClick={send} disabled={sending} style={{ padding: "6px 10px", border: "1px solid var(--ok-line)", background: "#fff", color: "var(--ok)", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{sending ? "…" : "Reenviar"}</button>
        </div>
      ) : (
        <button type="button" onClick={send} disabled={sending || !hasPhone} style={{ ...optStyle(hasPhone), opacity: hasPhone ? 1 : 0.6, cursor: hasPhone ? "pointer" : "not-allowed" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{sending ? "Enviando…" : "Enviar por WhatsApp"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rc && !hasPhone ? "La orden no tiene celular del cliente" : sent === false ? "No se pudo enviar al entregar · inténtalo de nuevo" : "Le llega el enlace a su comprobante"}</div>
          </div>
          <span style={{ color: "var(--ok)", fontWeight: 700 }}>›</span>
        </button>
      )}
      {failed && wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...optStyle(), background: "var(--ok-bg)", borderStyle: "dashed", borderColor: "var(--ok-line)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>Abrir WhatsApp con el mensaje listo</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>No se pudo desde el número del taller: envíalo tú</div>
          </div>
        </a>
      )}
      {mailOpen ? (
        <div style={{ ...optStyle(true), flexDirection: "column", alignItems: "stretch", cursor: "default", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Enviar por correo</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Con el detalle y el enlace al comprobante · se guarda en la orden</div>
            </div>
            <button type="button" onClick={() => setMailOpen(false)} aria-label="Cerrar" style={{ border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "var(--text-muted)" }}><X size={16} strokeWidth={STROKE} aria-hidden="true" /></button>
          </div>
          <EmailSend autoFocus defaultEmail={rc?.email} send={async (email) => {
            const r = await apiFetch("/api/receipt", { method: "POST", body: JSON.stringify({ code, email }) });
            const d = await r.json().catch(() => ({}));
            if (d.sent && rc) setRc({ ...rc, email });
            return { ok: !!d.sent, error: d.error };
          }} />
        </div>
      ) : (
        <button type="button" onClick={() => setMailOpen(true)} disabled={!rc} style={optStyle()}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Enviar por correo</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rc?.email ? `A ${rc.email}` : "Con el detalle y el enlace al comprobante"}</div>
          </div>
          <span style={{ color: "var(--info-bright)", fontWeight: 700 }}>›</span>
        </button>
      )}
      <button type="button" onClick={copy} disabled={!rc} style={optStyle()}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Copiar enlace del comprobante</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Para mandarlo por otro medio</div>
        </div>
      </button>
    </div>
  );
}

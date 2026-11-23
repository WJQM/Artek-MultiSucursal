"use client";
// Campo de correo + botón "Enviar" (comprobantes, cotizaciones y notas de venta).
import { useState } from "react";
import { sileo } from "@/frontend/lib/toast";

const valid = (s: string) => /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(s.trim());

export default function EmailSend({ defaultEmail, send, label = "Enviar", accent = "#2563eb", autoFocus }: {
  defaultEmail?: string | null;
  send: (email: string) => Promise<{ ok: boolean; error?: string }>;
  label?: string; accent?: string; autoFocus?: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid(email)) { sileo.warning({ title: "Escribe un correo válido", description: "Ej: cliente@gmail.com" }); return; }
    setBusy(true);
    try {
      const r = await send(email.trim());
      if (r.ok) { setDone(email.trim()); sileo.success({ title: "Correo enviado", description: email.trim() }); }
      else sileo.error({ title: "No se pudo enviar el correo", description: r.error });
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input aria-label="Correo del cliente" type="email" inputMode="email" autoComplete="email" autoFocus={autoFocus} value={email} onChange={(e) => { setEmail(e.target.value); setDone(null); }} placeholder="cliente@gmail.com"
        style={{ flex: "1 1 200px", minWidth: 0, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff", color: "var(--text-primary)" }} />
      <button type="submit" disabled={busy} style={{ padding: "10px 16px", background: done === email.trim() ? "var(--ok)" : accent, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap" }}>
        {busy ? "Enviando…" : done === email.trim() ? "✓ Enviado" : label}
      </button>
    </form>
  );
}

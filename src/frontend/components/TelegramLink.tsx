"use client";
import { Send } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Mi cuenta → "Telegram": vincular el Telegram de la persona para recibir los avisos también ahí.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "20px 20px", marginBottom: 16, boxShadow: "0 2px 10px rgba(30,42,58,0.05)" };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#1e2a3a", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const p: React.CSSProperties = { fontSize: 12, color: "#5a6a80", marginBottom: 14, lineHeight: 1.5 };
const btn: React.CSSProperties = { padding: "10px 16px", border: "none", borderRadius: 10, background: "#229ED9", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-block" };
const ghost: React.CSSProperties = { padding: "10px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

interface State { bot: { ready: boolean; username: string }; link: { name: string; at: string } | null }

export default function TelegramLink() {
  const [st, setSt] = useState<State | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/telegram/link");
    if (r.ok) setSt(await r.json());
  }, []);
  useEffect(() => { load(); return () => { if (poll.current) clearInterval(poll.current); }; }, [load]);

  const post = (action: string) => apiFetch("/api/telegram/link", { method: "POST", body: JSON.stringify({ action }) });

  const check = useCallback(async (quiet = false) => {
    const d = await (await post("check")).json().catch(() => ({}));
    if (d.linked) {
      if (poll.current) { clearInterval(poll.current); poll.current = null; }
      setUrl(null); await load();
      sileo.success({ title: "Telegram vinculado", description: "Te enviamos un mensaje de bienvenida" });
    } else if (!quiet) sileo.warning({ title: "Todavía no", description: "Abre el bot y toca “Iniciar”" });
  }, [load]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await post("start");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo iniciar" }); return; }
      setUrl(d.url);
      // Revisa solo cada 4 s durante 3 minutos
      if (poll.current) clearInterval(poll.current);
      let n = 0;
      poll.current = setInterval(() => { n++; if (n > 45 && poll.current) { clearInterval(poll.current); poll.current = null; return; } check(true); }, 4000);
    } finally { setBusy(false); }
  };

  if (!st || !st.bot.ready) return null;

  return (
    <div style={card}>
      <div style={h2}><Send size={14} strokeWidth={STROKE} aria-hidden="true" /> Telegram {st.link && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "rgba(16,185,129,0.1)", color: "var(--ok)" }}>Vinculado</span>}</div>
      <p style={p}>Recibe los mismos avisos que elegiste arriba también por Telegram (gratis). Sirve de respaldo si falla WhatsApp.</p>
      {st.link ? (
        <>
          <div style={{ fontSize: 13, marginBottom: 12 }}>Vinculado con <b>{st.link.name}</b> en <b>@{st.bot.username}</b></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={async () => { const r = await post("test"); const d = await r.json().catch(() => ({})); if (r.ok) sileo.success({ title: "Mensaje de prueba enviado" }); else sileo.error({ title: d.error || "No se pudo enviar" }); }} style={ghost}>Enviar prueba</button>
            <button disabled={busy} onClick={async () => { await post("unlink"); sileo.success({ title: "Telegram desvinculado" }); load(); }} style={ghost}>Desvincular</button>
          </div>
        </>
      ) : url ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ol style={{ margin: "0 0 0 18px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <li>Toca <b><Send size={14} strokeWidth={STROKE} aria-hidden="true" /> Abrir Telegram</b>.</li>
            <li>En el chat del bot toca <b>Iniciar</b> (o <b>Start</b>).</li>
            <li>Vuelve aquí: se vincula solo en unos segundos.</li>
          </ol>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={btn}>Abrir Telegram</a>
            <button onClick={() => check(false)} style={ghost}>Ya toqué Iniciar</button>
          </div>
        </div>
      ) : (
        <button disabled={busy} onClick={start} style={btn}>{busy ? "…" : "Vincular mi Telegram"}</button>
      )}
    </div>
  );
}

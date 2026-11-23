"use client";
import { KeyRound, ShieldCheck } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/frontend/components/PasswordInput";
import { PhoneInput } from "@/frontend/components/PhoneInput";
import type { SessionUser } from "@/frontend/lib/api";

/** Respuesta del servidor cuando falta un paso (login, registro) */
export interface StepState {
  stage: "change_password" | "2fa" | "2fa_setup" | "verify_phone";
  challenge: string;
  methods?: ("totp" | "whatsapp" | "backup")[];
  maskedPhone?: string;
  pinSent?: boolean;
  pinError?: string;
}

/** Lo que responde /api/auth/step: la sesión lista, el paso siguiente o un error */
type StepReply = Partial<StepState> & { token?: string; user?: SessionUser; error?: string; registered?: boolean; status?: string };

interface Props {
  initial: StepState;
  onSession: (data: { token: string; user: SessionUser }) => void;
  onRegistered?: (status: string) => void; // registro verificado
  onCancel: () => void;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "13px 16px", background: "#f5f7fc", border: "1px solid #e2e8f0", borderRadius: 11,
  color: "#1a1d2e", fontSize: 14, outline: "none", fontFamily: "inherit",
};
const codeSt: React.CSSProperties = { ...inputSt, fontSize: 24, letterSpacing: 10, textAlign: "center", fontWeight: 700, fontFamily: "monospace" };
const btnSt = (disabled: boolean): React.CSSProperties => ({
  width: "100%", padding: 14, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: disabled ? "wait" : "pointer",
  background: disabled ? "#e5e8f0" : "linear-gradient(135deg,var(--accent-dim),var(--accent))", color: disabled ? "#94a3b8" : "#fff",
});
const linkSt: React.CSSProperties = { background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 4 };
const labelSt: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 7 };

async function step(body: Record<string, unknown>) {
  const res = await fetch("/api/auth/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data: StepReply = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function AuthSteps({ initial, onSession, onRegistered, onCancel }: Props) {
  const [st, setSt] = useState<StepState>(initial);
  const [method, setMethod] = useState<"totp" | "whatsapp" | "backup">(
    initial.methods?.includes("totp") ? "totp" : initial.methods?.includes("whatsapp") ? "whatsapp" : "backup"
  );
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(initial.pinError || "");
  const [info, setInfo] = useState(initial.pinSent ? `Te enviamos un código por WhatsApp al ${initial.maskedPhone}` : "");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(initial.pinSent ? 60 : 0);
  const [phoneSent, setPhoneSent] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  useEffect(() => { codeRef.current?.focus(); }, [st.stage, method, phoneSent]);

  const handle = (r: { ok: boolean; status: number; data: StepReply }) => {
    if (r.data?.token && r.data.user) { onSession({ token: r.data.token, user: r.data.user }); return true; }
    if (r.status === 401) { setError(r.data?.error || "La verificación venció"); setTimeout(onCancel, 1800); return false; }
    if (!r.ok) { setError(r.data?.error || "Error"); return false; }
    if (r.data?.stage) {
      setSt(r.data as StepState); setCode(""); setError(r.data.pinError || "");
      if (r.data.methods) setMethod(r.data.methods.includes("totp") ? "totp" : r.data.methods.includes("whatsapp") ? "whatsapp" : "backup");
      setInfo(r.data.pinSent ? `Te enviamos un código por WhatsApp al ${r.data.maskedPhone}` : "");
      if (r.data.pinSent) setCooldown(60);
      return true;
    }
    return true;
  };

  const sendPin = async () => {
    setError(""); setBusy(true);
    const r = await step({ challenge: st.challenge, action: st.stage === "verify_phone" ? "resend_register" : "send_pin" });
    setBusy(false);
    if (r.ok) { setInfo(`Te enviamos un código por WhatsApp al ${r.data.maskedPhone}`); setCooldown(60); setMethod("whatsapp"); }
    else setError(r.data?.error || "No se pudo enviar");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (st.stage === "change_password") {
        if (pw1 !== pw2) { setError("Las contraseñas no coinciden"); return; }
        handle(await step({ challenge: st.challenge, action: "change_password", newPassword: pw1 }));
      } else if (st.stage === "2fa") {
        handle(await step({ challenge: st.challenge, action: "verify", method, code, remember }));
      } else if (st.stage === "2fa_setup") {
        if (!phoneSent) {
          const r = await step({ challenge: st.challenge, action: "setup_phone", phone });
          if (r.ok) { setSt({ ...st, challenge: r.data.challenge ?? st.challenge }); setPhoneSent(true); setInfo(`Te enviamos un código por WhatsApp al ${r.data.maskedPhone}`); setCooldown(60); }
          else setError(r.data?.error || "Error");
        } else {
          handle(await step({ challenge: st.challenge, action: "verify_setup_phone", code, remember }));
        }
      } else if (st.stage === "verify_phone") {
        const r = await step({ challenge: st.challenge, action: "verify_phone", code });
        if (r.ok && r.data.registered) onRegistered?.(r.data.status ?? "");
        else setError(r.data?.error || "Error");
      }
    } finally { setBusy(false); }
  };

  const title = {
    change_password: "Crea una contraseña nueva",
    "2fa": "Verificación en dos pasos",
    "2fa_setup": "Protege tu cuenta",
    verify_phone: "Verifica tu celular",
  }[st.stage];
  const subtitle = {
    change_password: "Estás usando una contraseña temporal. Elige una nueva para continuar.",
    "2fa": method === "totp" ? "Abre tu app autenticadora e ingresa el código de 6 dígitos." : method === "backup" ? "Ingresa uno de tus códigos de respaldo (formato XXXX-XXXX)." : "Ingresa el código de 6 dígitos que te enviamos por WhatsApp.",
    "2fa_setup": phoneSent ? "Ingresa el código que te enviamos por WhatsApp." : "Tu rol requiere doble verificación. Registra tu celular con WhatsApp para recibir un código al iniciar sesión.",
    verify_phone: `Te enviamos un código por WhatsApp al ${st.maskedPhone || "celular registrado"}.`,
  }[st.stage];

  const showCode = st.stage === "2fa" || st.stage === "verify_phone" || (st.stage === "2fa_setup" && phoneSent);
  const canResend = (st.stage === "2fa" && method === "whatsapp") || st.stage === "verify_phone";
  const methodLabel = { totp: "App autenticadora", whatsapp: "WhatsApp", backup: "Código de respaldo" };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>{st.stage === "change_password" ? <KeyRound size={34} strokeWidth={STROKE} aria-hidden="true" /> : <ShieldCheck size={34} strokeWidth={STROKE} aria-hidden="true" />}</div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1a1d2e", marginBottom: 6 }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{subtitle}</p>
      </div>

      {st.stage === "2fa" && (st.methods?.length || 0) > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {st.methods!.map((m) => (
            <button key={m} type="button" onClick={() => { setMethod(m); setCode(""); setError(""); }}
              style={{ flex: 1, minWidth: 100, padding: "8px 6px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${method === m ? "var(--accent)" : "var(--border-soft)"}`, background: method === m ? "rgba(var(--accent-bright-rgb), 0.08)" : "#fff", color: method === m ? "var(--accent-dim)" : "var(--text-muted)" }}>
              {methodLabel[m]}
            </button>
          ))}
        </div>
      )}

      {info && !error && <div style={{ padding: "10px 12px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "var(--ok)", fontSize: 12, marginBottom: 14 }}>{info}</div>}
      {error && <div style={{ padding: "10px 12px", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 10, color: "var(--danger-bright)", fontSize: 12, marginBottom: 14 }}>{error}</div>}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {st.stage === "change_password" && (
          <>
            <div><label htmlFor="f-authsteps-1" style={labelSt}>Contraseña nueva</label><PasswordInput id="f-authsteps-1" style={inputSt} autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} required /><p style={{ fontSize: 12, color: "#5a6a80", marginTop: 6 }}>Mínimo 8 caracteres, con letras y números.</p></div>
            <div><label htmlFor="f-authsteps-2" style={labelSt}>Repite la contraseña</label><PasswordInput id="f-authsteps-2" style={inputSt} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
          </>
        )}

        {st.stage === "2fa_setup" && !phoneSent && (
          <div><label htmlFor="f-authsteps-3" style={labelSt}>Celular con WhatsApp</label><PhoneInput id="f-authsteps-3" style={inputSt} value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        )}

        {showCode && (
          method === "backup" && st.stage === "2fa"
            ? <input aria-label="Código de respaldo" ref={codeRef} style={{ ...codeSt, letterSpacing: 4 }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" autoComplete="one-time-code" required />
            : <input aria-label="Código de verificación" ref={codeRef} style={codeSt} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required />
        )}

        {(st.stage === "2fa" || (st.stage === "2fa_setup" && phoneSent)) && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16 }} />
            Recordar este dispositivo por 30 días
          </label>
        )}

        <button type="submit" disabled={busy} style={btnSt(busy)}>
          {busy ? "Verificando..." : st.stage === "change_password" ? "Guardar y continuar" : st.stage === "2fa_setup" && !phoneSent ? "Enviar código por WhatsApp" : "Verificar"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 6 }}>
        <button type="button" onClick={onCancel} style={{ ...linkSt, color: "var(--text-muted)" }}>← Volver</button>
        {canResend && (
          <button type="button" onClick={sendPin} disabled={busy || cooldown > 0} style={{ ...linkSt, opacity: cooldown > 0 ? 0.5 : 1 }}>
            {cooldown > 0 ? `Reenviar código en ${cooldown} s` : st.stage === "2fa" && !info ? "Enviarme el código por WhatsApp" : "Reenviar código"}
          </button>
        )}
        {st.stage === "2fa" && method !== "whatsapp" && st.methods?.includes("whatsapp") && (
          <button type="button" onClick={sendPin} disabled={busy || cooldown > 0} style={linkSt}>¿Sin la app? Recibir PIN por WhatsApp</button>
        )}
      </div>
    </div>
  );
}

"use client";
import { TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { PasswordInput } from "@/frontend/components/PasswordInput";
import { useRouter } from "next/navigation";
import { apiFetch, type SessionUser } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import PushSettings from "@/frontend/components/PushSettings";
import TelegramLink from "@/frontend/components/TelegramLink";
import { askConfirm } from "@/frontend/lib/dialog";
import { ListSkeleton } from "@/frontend/components/Skeletons";

interface Account {
  name: string; email: string; role: string; phone: string | null; phoneVerified: boolean;
  twoFactorRequired: boolean; twoFactorEnabled: boolean; totpEnabled: boolean; backupCodesLeft: number;
  trustedDevices: number; passwordChangedAt: string | null;
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "20px 20px", marginBottom: 16, boxShadow: "0 2px 10px rgba(30,42,58,0.05)" };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#1e2a3a", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 };
const p: React.CSSProperties = { fontSize: 12, color: "#5a6a80", marginBottom: 14, lineHeight: 1.5 };
const input: React.CSSProperties = { width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none" };
const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 };
const btn = (color = "var(--accent)"): React.CSSProperties => ({ padding: "10px 16px", border: "none", borderRadius: 10, background: color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const ghost: React.CSSProperties = { padding: "10px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const badge = (ok: boolean): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: ok ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.12)", color: ok ? "#047857" : "#b45309" });
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

export default function MiCuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [acc, setAcc] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  // formularios
  const [cur, setCur] = useState(""); const [n1, setN1] = useState(""); const [n2, setN2] = useState("");
  const [newPhone, setNewPhone] = useState(""); const [phoneCode, setPhoneCode] = useState(""); const [phoneSent, setPhoneSent] = useState(false);
  const [totpQr, setTotpQr] = useState<string | null>(null); const [totpSecret, setTotpSecret] = useState(""); const [totpCode, setTotpCode] = useState("");
  const [disablePw, setDisablePw] = useState(""); const [disableCode, setDisableCode] = useState(""); const [showDisable, setShowDisable] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null); const [regenPw, setRegenPw] = useState(""); const [showRegen, setShowRegen] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const raw = sessionStorage.getItem("user");
    if (!token || !raw) { router.push("/"); return; }
    try { setUser(JSON.parse(raw)); } catch { router.push("/"); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const r = await apiFetch("/api/account");
    if (r.ok) setAcc(await r.json());
  };

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/account", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "Error" }); return null; }
      if (d.token) { // nueva sesión para este dispositivo
        sessionStorage.setItem("token", d.token);
        sessionStorage.setItem("user", JSON.stringify(d.user));
      }
      return d;
    } finally { setBusy(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (n1 !== n2) { sileo.error({ title: "Las contraseñas no coinciden" }); return; }
    const d = await act({ action: "change_password", currentPassword: cur, newPassword: n1 });
    if (d) { sileo.success({ title: d.message || "Contraseña actualizada" }); setCur(""); setN1(""); setN2(""); load(); }
  };

  const sendPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSent) {
      const d = await act({ action: "phone_send", phone: newPhone });
      if (d) { setPhoneSent(true); sileo.success({ title: `Código enviado al ${d.maskedPhone}` }); }
    } else {
      const d = await act({ action: "phone_verify", code: phoneCode });
      if (d) { sileo.success({ title: "Celular verificado" }); setPhoneSent(false); setNewPhone(""); setPhoneCode(""); load(); }
    }
  };

  const beginTotp = async () => {
    const d = await act({ action: "totp_begin" });
    if (d) { setTotpQr(d.qr); setTotpSecret(d.secret); }
  };
  const confirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await act({ action: "totp_confirm", code: totpCode });
    if (d) { setTotpQr(null); setTotpSecret(""); setTotpCode(""); setCodes(d.backupCodes); sileo.success({ title: "App autenticadora activada" }); load(); }
  };
  const disableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await act({ action: "totp_disable", currentPassword: disablePw, code: disableCode });
    if (d) { setShowDisable(false); setDisablePw(""); setDisableCode(""); sileo.success({ title: "App autenticadora desactivada" }); load(); }
  };
  const regenCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await act({ action: "backup_regenerate", currentPassword: regenPw });
    if (d) { setCodes(d.backupCodes); setShowRegen(false); setRegenPw(""); load(); }
  };

  const toggle2fa = async (enabled: boolean) => {
    const d = await act({ action: "set_2fa", enabled });
    if (d) { sileo.success({ title: enabled ? "PIN al iniciar sesión activado" : "PIN al iniciar sesión desactivado" }); load(); }
  };

  const logoutOthers = async () => {
    if (!await askConfirm("Se cerrará tu sesión en todos los demás celulares y computadoras. ¿Continuar?")) return;
    const d = await act({ action: "logout_others" });
    if (d) { sileo.success({ title: d.message }); load(); }
  };

  const copyCodes = () => { if (codes) navigator.clipboard?.writeText(codes.join("\n")).then(() => sileo.success({ title: "Códigos copiados" })).catch(() => {}); };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Mi cuenta</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Contraseña, celular, verificación en dos pasos y avisos</p>

          {!acc ? <ListSkeleton rows={3} /> : (<>

            {/* Resumen */}
            <div style={{ ...card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{acc.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{acc.email}</div>
              </div>
              <span style={badge(acc.twoFactorEnabled)}>{acc.twoFactorEnabled ? "✓ Verificación en dos pasos activa" : "Verificación en dos pasos desactivada"}</span>
            </div>

            {user.role === "superadmin" && !acc.totpEnabled && (
              <div style={{ ...card, background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.35)" }}>
                <div style={{ fontWeight: 700, color: "var(--warn)", marginBottom: 4 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> Recomendado: activa la app autenticadora</div>
                <div style={{ fontSize: 12, color: "var(--warn)" }}>Si WhatsApp deja de funcionar, la app y los códigos de respaldo son tu forma de entrar como Super Admin.</div>
              </div>
            )}

            {/* Contraseña */}
            <form onSubmit={changePassword} style={card}>
              <div style={h2}>Contraseña</div>
              <p style={p}>
                Al cambiarla se cerrará tu sesión en los demás dispositivos.
                {acc.passwordChangedAt && <> Último cambio: {new Date(acc.passwordChangedAt).toLocaleDateString("es-BO")}.</>}
              </p>
              <div style={{ marginBottom: 12 }}><label htmlFor="f-mi-cuenta-1" style={label}>Contraseña actual</label><PasswordInput id="f-mi-cuenta-1" style={input} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
              <div className="form-grid" style={{ ...grid, marginBottom: 14 }}>
                <div><label htmlFor="f-mi-cuenta-2" style={label}>Nueva</label><PasswordInput id="f-mi-cuenta-2" style={input} autoComplete="new-password" value={n1} onChange={(e) => setN1(e.target.value)} placeholder="8+ caracteres, letras y números" required /></div>
                <div><label htmlFor="f-mi-cuenta-3" style={label}>Repetir nueva</label><PasswordInput id="f-mi-cuenta-3" style={input} autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} required /></div>
              </div>
              <button disabled={busy} style={btn()}>Cambiar contraseña</button>
            </form>

            {/* Celular */}
            <form onSubmit={sendPhone} style={card}>
              <div style={h2}>Celular (WhatsApp) {acc.phone && <span style={badge(acc.phoneVerified)}>{acc.phoneVerified ? "Verificado" : "Sin verificar"}</span>}</div>
              <p style={p}>{acc.phone ? `Registrado: ${acc.phone}. ` : "No tienes celular registrado. "}Se usa para el PIN de inicio de sesión y para recuperar tu contraseña.</p>
              {!phoneSent ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input aria-label="Número de celular" style={{ ...input, flex: "1 1 200px", minWidth: 0 }} type="tel" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder={acc.phone ? "Nuevo número" : "Número de celular"} required />
                  <button disabled={busy} style={btn()}>{acc.phone ? "Cambiar" : "Registrar"}</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input aria-label="Código recibido por WhatsApp" style={{ ...input, flex: 1, minWidth: 140, letterSpacing: 6, textAlign: "center", fontWeight: 700 }} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" required />
                  <button disabled={busy} style={btn()}>Verificar</button>
                  <button type="button" onClick={() => { setPhoneSent(false); setPhoneCode(""); }} style={ghost}>Cancelar</button>
                </div>
              )}
            </form>

            {/* PIN al iniciar sesión */}
            <div style={card}>
              <div style={h2}>PIN al iniciar sesión</div>
              {acc.twoFactorRequired ? (
                <p style={{ ...p, marginBottom: 0 }}>Obligatorio para administradores. Al entrar desde un dispositivo nuevo se pide un código de WhatsApp o de tu app autenticadora (puedes marcar &quot;Recordar este dispositivo por 30 días&quot;).</p>
              ) : (
                <>
                  <p style={p}>Opcional para técnicos. Si lo activas, al entrar desde un dispositivo nuevo te pediremos un código.</p>
                  <button disabled={busy} onClick={() => toggle2fa(!acc.twoFactorEnabled)} style={acc.twoFactorEnabled ? ghost : btn()}>{acc.twoFactorEnabled ? "Desactivar" : "Activar"}</button>
                </>
              )}
            </div>

            {/* App autenticadora */}
            <div style={card}>
              <div style={h2}>App autenticadora <span style={badge(acc.totpEnabled)}>{acc.totpEnabled ? "Activa" : "No configurada"}</span></div>
              <p style={p}>Google Authenticator, Microsoft Authenticator o Authy. Funciona sin internet y no depende de WhatsApp.</p>

              {!acc.totpEnabled && !totpQr && <button disabled={busy} onClick={beginTotp} style={btn()}>Configurar app autenticadora</button>}

              {totpQr && (
                <form onSubmit={confirmTotp}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
                    {["Abre la app y elige \"Agregar cuenta\" → \"Escanear código QR\".", "Escanea este código (o escribe la clave manualmente).", "Escribe el código de 6 dígitos que muestra la app."].map((t, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "rgba(var(--accent-bright-rgb), 0.12)", color: "var(--accent-dim)", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                    <img src={totpQr} alt="Código QR" width={180} height={180} style={{ border: "1px solid var(--border-soft)", borderRadius: 10 }} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={label}>Clave manual</label>
                      <code style={{ display: "block", fontSize: 12, wordBreak: "break-all", background: "#f5f7fc", padding: 10, borderRadius: 8, marginBottom: 10 }}>{totpSecret.match(/.{1,4}/g)?.join(" ")}</code>
                      <input aria-label="Código de la app autenticadora" style={{ ...input, letterSpacing: 6, textAlign: "center", fontWeight: 700 }} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" required />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={busy} style={btn()}>Activar</button>
                    <button type="button" onClick={() => { setTotpQr(null); setTotpSecret(""); }} style={ghost}>Cancelar</button>
                  </div>
                </form>
              )}

              {acc.totpEnabled && (
                <>
                  <p style={{ ...p, marginBottom: 10 }}>Códigos de respaldo disponibles: <b>{acc.backupCodesLeft}</b> de 10.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => { setShowRegen(!showRegen); setShowDisable(false); }} style={ghost}>Generar códigos nuevos</button>
                    <button onClick={() => { setShowDisable(!showDisable); setShowRegen(false); }} style={{ ...ghost, color: "var(--danger-bright)" }}>Desactivar app</button>
                  </div>
                  {showRegen && (
                    <form onSubmit={regenCodes} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <PasswordInput style={{ ...input, flex: 1, minWidth: 160 }} value={regenPw} onChange={(e) => setRegenPw(e.target.value)} placeholder="Tu contraseña actual" required />
                      <button disabled={busy} style={btn()}>Generar</button>
                    </form>
                  )}
                  {showDisable && (
                    <form onSubmit={disableTotp} className="form-grid" style={{ ...grid, marginTop: 12 }}>
                      <PasswordInput style={input} value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Tu contraseña actual" required />
                      <input aria-label="Código de la app autenticadora" style={input} value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de la app" required />
                      <button disabled={busy} style={btn("#dc2626")}>Desactivar</button>
                    </form>
                  )}
                </>
              )}

              {codes && (
                <div style={{ marginTop: 16, padding: 16, background: "rgba(245,158,11,0.06)", border: "1.5px dashed rgba(245,158,11,0.5)", borderRadius: 12 }}>
                  <div style={{ fontWeight: 700, color: "var(--warn)", marginBottom: 6 }}>Guarda estos códigos de respaldo</div>
                  <p style={{ fontSize: 12, color: "var(--warn)", marginBottom: 10 }}>Cada uno sirve una sola vez para entrar si pierdes el celular. No se volverán a mostrar.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, fontFamily: "monospace", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                    {codes.map((c) => <div key={c} style={{ background: "#fff", padding: "6px 10px", borderRadius: 6, textAlign: "center" }}>{c}</div>)}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={copyCodes} style={btn("#b45309")}>Copiar</button>
                    <button onClick={() => window.print()} style={ghost}>Imprimir</button>
                    <button onClick={() => setCodes(null)} style={ghost}>Ya los guardé</button>
                  </div>
                </div>
              )}
            </div>

            <PushSettings />
            <TelegramLink />

            {/* Sesiones */}
            <div style={card}>
              <div style={h2}>Sesiones y dispositivos</div>
              <p style={p}>Dispositivos recordados (no piden PIN): <b>{acc.trustedDevices}</b>. Si perdiste un celular o usaste una computadora ajena, cierra las demás sesiones.</p>
              <button disabled={busy} onClick={logoutOthers} style={btn("#1e2a3a")}>Cerrar sesión en los demás dispositivos</button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

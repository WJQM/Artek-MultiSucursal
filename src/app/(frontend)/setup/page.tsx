"use client";
import { useState, useEffect } from "react";
import { PasswordInput } from "@/frontend/components/PasswordInput";
import { PhoneInput } from "@/frontend/components/PhoneInput";
import { AppLogo } from "@/frontend/components/AppLogo";
import { useRouter } from "next/navigation";
import { Turnstile } from "@/frontend/components/Turnstile";
import { AuthSteps, type StepState } from "@/frontend/components/AuthSteps";
import { completeLogin } from "@/frontend/lib/api";
import { AuthLayout, type AuthFeature } from "@/frontend/components/AuthLayout";
import { Lock, ShieldCheck, Store, User, Wallet } from "@/frontend/components/icons";

const FEATURES: AuthFeature[] = [
  { Icon: Store, title: "Sucursales y personal", text: "Altas, permisos y traspasos entre sucursales." },
  { Icon: Wallet, title: "Finanzas y respaldos", text: "Caja, reportes y copia de seguridad diaria." },
  { Icon: ShieldCheck, title: "Verificación en dos pasos", text: "Código por app autenticadora o WhatsApp." },
];

export default function SetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  // "Crear primer Super Admin" solo aparece en una instalación nueva (sin ningún Super Admin)
  const [hasSuperadmin, setHasSuperadmin] = useState(true);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [stepState, setStepState] = useState<StepState | null>(null);
  const renewCaptcha = () => setCaptchaKey((k) => k + 1);
  const [settings, setSettings] = useState<{ companyName: string; logo: string | null }>({ companyName: "", logo: null });

  useEffect(() => setMounted(true), []);
  useEffect(() => { fetch("/api/auth/setup").then(r => r.json()).then(d => { const has = d?.hasSuperadmin !== false; setHasSuperadmin(has); if (!has) setMode("register"); }).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, logo: d.logo }); }).catch(() => {}); }, []);

  const handleImageUpload = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { setImageUrl(data.url); setImagePreview(URL.createObjectURL(file)); }
    } catch {}
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (captchaEnabled && !captchaToken) { setError("Espera un momento: verificando que no eres un robot…"); return; }
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role: "superadmin", phone, image: imageUrl || null, captchaToken }) });
        const data = await res.json();
        renewCaptcha();
        if (!res.ok) { setError(data.error || "Error al registrar"); return; }
        setStepState(data); // verificar celular con PIN
      } else {
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, captchaToken, panel: "setup" }) });
        const data = await res.json();
        renewCaptcha();
        if (!res.ok) { setError(data.error || "Error al iniciar sesión"); return; }
        if (data.stage) { setStepState(data); return; }
        if (data.user.role !== "superadmin") { setError("Esta página es solo para Super Admins."); return; }
        await completeLogin(data, (p) => router.push(p));
      }
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  const year = new Date().getFullYear();

  return (
    <AuthLayout
      brand={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
            {settings.logo
              ? <img src={settings.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <AppLogo size={36} title="Logo" />}
          </div>
          <b style={{ fontSize: 16, color: "#fff" }}>{settings.companyName || "RepairTrackQR"}</b>
        </div>
      }
      title={<>Administración<br /><span>general del sistema.</span></>}
      subtitle="Solo para el dueño o encargado general del taller."
      features={FEATURES}
      footer={<>© {year} {settings.companyName || "RepairTrackQR"}</>}
      mounted={mounted}
    >
          {stepState ? (
            <AuthSteps
              initial={stepState}
              onSession={(d) => { if (d.user?.role !== "superadmin") { setStepState(null); setError("Esta página es solo para Super Admins."); return; } completeLogin(d, (p) => router.push(p)); }}
              onRegistered={() => { setStepState(null); setMode("login"); setName(""); setPhone(""); setPassword(""); setSuccess("Super Admin creado y celular verificado. Ahora inicia sesión."); }}
              onCancel={() => setStepState(null)}
            />
          ) : (
            <>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>{mode === "register" ? "Crear Super Admin" : "Iniciar sesión"}</h1>
              <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "8px 0 24px" }}>
                {mode === "register" ? "Configura la cuenta principal del sistema." : "Acceso a la administración general del sistema."}
              </p>

              {!hasSuperadmin && (
                <div style={{ display: "flex", background: "var(--bg-hover)", borderRadius: 10, padding: 4, marginBottom: 22 }}>
                  {["Iniciar sesión", "Crear primer Super Admin"].map((label, i) => {
                    const active = i === 0 ? mode === "login" : mode === "register";
                    return (
                      <button key={i} type="button" onClick={() => { setMode(i === 0 ? "login" : "register"); setError(""); setSuccess(""); }}
                        style={{ flex: 1, padding: "9px 8px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: active ? "#fff" : "transparent", color: active ? "var(--text-primary)" : "var(--text-muted)", boxShadow: active ? "0 1px 3px rgba(16,24,40,.12)" : "none" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && <div role="alert" style={{ padding: "10px 14px", background: "var(--danger-bg)", border: "1px solid var(--danger-line)", borderRadius: 8, color: "var(--danger)", fontSize: 13 }}>{error}</div>}
                {success && <div style={{ padding: "10px 14px", background: "var(--ok-bg)", border: "1px solid var(--ok-line)", borderRadius: 8, color: "var(--ok)", fontSize: 13 }}>{success}</div>}

                {mode === "register" && (
                  <>
                    <div>
                      <label htmlFor="f-setup-1" className="au-label">Nombre completo</label>
                      <input id="f-setup-1" className="au-input" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="f-setup-2" className="au-label">Celular con WhatsApp</label>
                      <PhoneInput id="f-setup-2" className="au-input" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="f-setup-3" className="au-label">Foto de perfil <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>(opcional)</span></label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--bg-tertiary)", border: "1px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                          {imagePreview ? <img src={imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="var(--text-muted)" aria-hidden="true" />}
                        </div>
                        <label style={{ padding: "8px 14px", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                          {uploading ? "Subiendo..." : imagePreview ? "Cambiar foto" : "Subir foto"}
                          <input id="f-setup-3" type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} style={{ display: "none" }} />
                        </label>
                        {imagePreview && <button type="button" className="au-link" onClick={() => { setImageUrl(""); setImagePreview(""); }} style={{ color: "var(--danger-bright)" }}>Quitar</button>}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="f-setup-4" className="au-label">Correo electrónico</label>
                  <input id="f-setup-4" className="au-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
                </div>
                <div>
                  <label htmlFor="f-setup-5" className="au-label">Contraseña</label>
                  <PasswordInput id="f-setup-5" className="au-input" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
                  {mode === "register" && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Mínimo 8 caracteres, con letras y números.</p>}
                </div>

                <Turnstile onToken={setCaptchaToken} onEnabled={setCaptchaEnabled} resetKey={captchaKey} />

                <button type="submit" className="au-btn" disabled={loading} style={{ cursor: loading ? "wait" : "pointer", opacity: loading ? 0.8 : 1 }}>
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                      Procesando...
                    </span>
                  ) : mode === "register" ? "Crear Super Admin" : "Continuar"}
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, marginTop: 22, fontSize: 14, color: "var(--text-muted)" }}>
                <Lock size={16} aria-hidden="true" /> Área restringida ·
                <button type="button" className="au-link tap-zone" onClick={() => router.push("/")}>Ingreso del personal</button>
              </div>
            </>
          )}
    </AuthLayout>
  );
}

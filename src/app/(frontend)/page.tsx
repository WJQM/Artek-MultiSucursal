"use client";
import { useState, useEffect } from "react";
import { PasswordInput } from "@/frontend/components/PasswordInput";
import { PhoneInput } from "@/frontend/components/PhoneInput";
import { AppLogo } from "@/frontend/components/AppLogo";
import { useRouter } from "next/navigation";
import { Turnstile } from "@/frontend/components/Turnstile";
import { AuthSteps, type StepState } from "@/frontend/components/AuthSteps";
import { completeLogin } from "@/frontend/lib/api";
import { pressKey } from "@/frontend/lib/a11y";
import { AuthLayout, type AuthFeature } from "@/frontend/components/AuthLayout";
import { ChartColumn, MessageCircle, QrCode, Shield, TriangleAlert, User, Wrench } from "@/frontend/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("tech");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  // Captcha, pasos de verificación y recuperación de contraseña
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [stepState, setStepState] = useState<StepState | null>(null);
  const [notice, setNotice] = useState("");
  const [forgot, setForgot] = useState<null | "email" | "code" | "password" | "done">(null);
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [needSecond, setNeedSecond] = useState(false);
  const [secondCode, setSecondCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const renewCaptcha = () => setCaptchaKey((k) => k + 1);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null }>({ companyName: "", slogan: "", logo: null });

  const refreshSettings = () => { fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, slogan: d.slogan, logo: d.logo }); }).catch(() => {}); };

  useEffect(() => {
    setMounted(true);
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (token && userData) {
      try {
        const parsed = (() => { try { return JSON.parse(userData); } catch { return null; } })();
        setTimeout(() => router.push(parsed.role === "tech" ? "/asignaciones" : "/dashboard"), 10);
        return;
      } catch {}
    }
    if (new URLSearchParams(window.location.search).get("expired")) setNotice("Tu sesión se cerró (cambio de contraseña o de permisos). Vuelve a iniciar sesión.");
    fetch("/api/branches", { headers: { "Content-Type": "application/json" } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setBranches(d); })
      .catch(() => {});
    refreshSettings();
  }, [router]);

  useEffect(() => { const interval = setInterval(refreshSettings, 30000); return () => clearInterval(interval); }, []);

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
    setError(""); setNotice("");
    if (captchaEnabled && !captchaToken) { setError("Espera un momento: verificando que no eres un robot…"); return; }
    setLoading(true);
    try {
      if (isRegister) {
        if (!branchId) { setError("Selecciona una sucursal"); setLoading(false); return; }
        const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role, phone, branchId, image: imageUrl || null, captchaToken }) });
        const data = await res.json();
        renewCaptcha();
        if (!res.ok) { setError(data.error || "Error al registrar"); setLoading(false); return; }
        setStepState(data); // verificar celular con PIN
      } else {
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, captchaToken }) });
        const data = await res.json();
        renewCaptcha();
        if (!res.ok) { setError(data.error || "Error en la solicitud"); setLoading(false); return; }
        if (data.stage) { setStepState(data); setLoading(false); return; }
        await completeLogin(data, (p) => setTimeout(() => router.push(p), 10));
      }
    } catch { setError("Error de conexión al servidor"); }
    setLoading(false);
  };

  // ---- ¿Olvidaste tu contraseña? ----
  const forgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setNotice("");
    setLoading(true);
    try {
      if (forgot === "email") {
        if (captchaEnabled && !captchaToken) { setError("Espera un momento: verificando que no eres un robot…"); return; }
        const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captchaToken }) });
        const data = await res.json(); renewCaptcha();
        if (!res.ok) { setError(data.error || "Error"); return; }
        setNotice(data.message); setForgot("code");
      } else if (forgot === "code") {
        const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: resetCode }) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Código incorrecto"); return; }
        setResetToken(data.resetToken); setNeedSecond(!!data.needSecondFactor); setForgot("password");
      } else if (forgot === "password") {
        if (newPw !== newPw2) { setError("Las contraseñas no coinciden"); return; }
        const second = /^\d{6}$/.test(secondCode.trim()) ? { totpCode: secondCode.trim() } : { backupCode: secondCode.trim() };
        const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resetToken, newPassword: newPw, ...(needSecond ? second : {}) }) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Error"); if (res.status === 401) setForgot("email"); return; }
        setForgot("done"); setPassword(""); setNewPw(""); setNewPw2(""); setSecondCode(""); setResetCode("");
      }
    } catch { setError("Error de conexión al servidor"); }
    finally { setLoading(false); }
  };

  const secretTap = () => { const n = tapCount + 1; if (n >= 5) { router.push("/setup"); return; } setTapCount(n); setTimeout(() => setTapCount(0), 2000); };

  const exitForgot = () => { setForgot(null); setError(""); setNotice(""); setResetCode(""); setResetToken(""); setNeedSecond(false); setSecondCode(""); };

  const company = settings.companyName || "RepairTrackQR";
  const FEATURES: AuthFeature[] = [
    { Icon: QrCode, title: "Órdenes con código QR", text: "Cada equipo identificado desde que entra." },
    { Icon: MessageCircle, title: "Avisos por WhatsApp", text: "El cliente sabe en qué etapa está su equipo." },
    { Icon: ChartColumn, title: "Reportes al día", text: "Ingresos, técnicos y sucursales en tiempo real." },
  ];

  return (
    <AuthLayout
      brand={<BrandMark logo={settings.logo} name={company} dark onSecretTap={secretTap} />}
      title={<>Tu taller, organizado<br /><span>en un solo lugar.</span></>}
      subtitle="Órdenes, avisos y reportes de todas tus sucursales."
      features={FEATURES}
      footer={<>© {new Date().getFullYear()} {company}{settings.slogan ? ` · ${settings.slogan}` : ""}</>}
      mounted={mounted}
    >
        {!stepState && !forgot && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 8 }}>{isRegister ? "Regístrate como administrador o técnico de una sucursal." : "Ingresa con tu cuenta del taller."}</p>
          </div>
        )}

        {stepState ? (
          <AuthSteps
            initial={stepState}
            onSession={(d) => completeLogin(d, (p) => setTimeout(() => router.push(p), 10))}
            onRegistered={() => { setStepState(null); setIsRegister(false); setPassword(""); setNotice("Celular verificado. Tu cuenta está pendiente de aprobación por el administrador."); }}
            onCancel={() => { setStepState(null); setError(""); }}
          />
        ) : forgot ? (
          <form onSubmit={forgotSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <h2 style={{ fontSize:24, fontWeight:700, color:"var(--text-primary)", marginBottom:8, letterSpacing:"-0.4px" }}>Recuperar contraseña</h2>
              <p style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.5 }}>
                {forgot === "email" && "Te enviaremos un código por WhatsApp a tu celular y a tu correo."}
                {forgot === "code" && "Ingresa el código de 6 dígitos que recibiste por WhatsApp o correo."}
                {forgot === "password" && "Elige tu nueva contraseña. Se cerrarán todas tus sesiones abiertas."}
                {forgot === "done" && "Listo. Ya puedes iniciar sesión con tu nueva contraseña."}
              </p>
            </div>
            {notice && forgot !== "done" && <div style={{ padding:"10px 12px", background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, color:"var(--ok)", fontSize:12 }}>{notice}</div>}
            {error && <div style={{ padding:"10px 12px", background:"rgba(244,63,94,0.06)", border:"1px solid rgba(244,63,94,0.15)", borderRadius:10, color:"var(--danger-bright)", fontSize:12 }}>{error}</div>}
            {forgot === "email" && (<>
              <div><label htmlFor="f-login-1" style={labelSt}>Correo electrónico</label><input id="f-login-1" className="au-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
              <Turnstile onToken={setCaptchaToken} onEnabled={setCaptchaEnabled} resetKey={captchaKey} />
            </>)}
            {forgot === "code" && (
              <input aria-label="Código de 6 dígitos" className="au-input" value={resetCode} onChange={e=>setResetCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required style={{ fontSize:24, letterSpacing:10, textAlign:"center", fontWeight:800, fontFamily:"monospace" }} />
            )}
            {forgot === "password" && (<>
              <div><label htmlFor="f-login-2" style={labelSt}>Contraseña nueva</label><PasswordInput id="f-login-2" className="au-input" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} required /><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Mínimo 8 caracteres, con letras y números.</p></div>
              <div><label htmlFor="f-login-3" style={labelSt}>Repite la contraseña</label><PasswordInput id="f-login-3" className="au-input" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} required /></div>
              {needSecond && <div><label htmlFor="f-login-4" style={labelSt}>Código de tu app autenticadora (o código de respaldo)</label><input id="f-login-4" className="au-input" value={secondCode} onChange={e=>setSecondCode(e.target.value.toUpperCase())} placeholder="123456 o XXXX-XXXX" required /></div>}
            </>)}
            {forgot !== "done" ? (
              <button type="submit" disabled={loading} style={{ width:"100%", padding:"13px", border:"none", borderRadius:8, fontSize:14.5, fontWeight:600, cursor:loading?"wait":"pointer", background: loading ? "var(--border-strong)" : "#0e7490", color: "#fff" }}>
                {loading ? "Procesando..." : forgot === "email" ? "Enviar código" : forgot === "code" ? "Verificar código" : "Guardar contraseña"}
              </button>
            ) : (
              <button type="button" onClick={exitForgot} style={{ width:"100%", padding:"13px", border:"none", borderRadius:8, fontSize:14.5, fontWeight:600, cursor:"pointer", background:"#0e7490", color:"#fff" }}>Ir a iniciar sesión</button>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
              <span role="button" tabIndex={0} onKeyDown={pressKey} onClick={exitForgot} style={{ color:"var(--text-muted)", cursor:"pointer", fontWeight:600 }}>← Volver</span>
              {forgot === "code" && <span role="button" tabIndex={0} onKeyDown={pressKey} onClick={()=>{ setForgot("email"); setError(""); setNotice(""); }} style={{ color:"#0e7490", cursor:"pointer", fontWeight:600 }}>¿No llegó? Pedir otro</span>}
            </div>
            <p style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", lineHeight:1.5 }}>¿No tienes celular registrado? Pide al administrador una contraseña temporal.</p>
          </form>
        ) : (<>
        {/* Tab toggle */}
        <div style={{ display: "flex", background: "var(--bg-hover)", borderRadius: 10, padding: 4, marginBottom: 22 }}>
          {["Iniciar sesión","Registrarse"].map((label,i) => {
            const active = i===0 ? !isRegister : isRegister;
            return (
              <button key={i} onClick={() => { setIsRegister(i===1); setError(""); }} style={{
                flex:1, padding:"9px", borderRadius:7, border:"none", fontSize:13, fontWeight:600, cursor:"pointer",
                background: active ? "#fff" : "transparent",
                color: active ? "var(--text-primary)" : "#526176",
                boxShadow: active ? "0 1px 3px rgba(16,24,40,.12)" : "none",
              }}>{label}</button>
            );
          })}
        </div>

        {notice && (
          <div style={{ padding:"12px 14px", background:"var(--ok-bg)", border:"1px solid var(--ok-line)", borderRadius:8, color:"var(--ok)", fontSize:13, marginBottom:18 }}>{notice}</div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding:"12px 14px", background:"var(--danger-bg)", border:"1px solid var(--danger-line)", borderRadius:8, color:"var(--danger)", fontSize:13, marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
            <TriangleAlert size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {isRegister && (
            <>
              <div>
                <label htmlFor="f-login-5" style={labelSt}>Nombre completo</label>
                <input id="f-login-5" className="au-input" type="text" value={name} onChange={e=>setName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="f-login-6" style={labelSt}>Foto de perfil (opcional)</label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:50, height:50, borderRadius:13, background:imagePreview?"transparent":"rgba(var(--accent-bright-rgb), 0.05)", border:"1px dashed rgba(212,168,67,0.2)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                    {imagePreview ? <img src={imagePreview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <User size={20} color="var(--text-muted)" aria-hidden="true" />}
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:"inline-block", padding:"7px 14px", background:"rgba(var(--accent-bright-rgb), 0.05)", border:"1px solid rgba(var(--accent-bright-rgb), 0.10)", borderRadius:9, color:"var(--accent)", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                      {uploading ? "Subiendo..." : imagePreview ? "Cambiar foto" : "Subir foto"}
                      <input id="f-login-6" type="file" accept="image/*" onChange={e=>{ if(e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} style={{ display:"none" }} />
                    </label>
                    {imagePreview && <button type="button" onClick={()=>{setImageUrl("");setImagePreview("");}} style={{ marginLeft:8, background:"none", border:"none", color:"var(--danger-bright)", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Quitar</button>}
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="f-login-7" style={labelSt}>Correo electrónico</label>
            <input id="f-login-7" className="au-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
              <label htmlFor="f-login-8" style={labelSt}>Contraseña</label>
              {!isRegister && <span className="au-link tap-zone" role="button" tabIndex={0} onClick={()=>{ setForgot("email"); setError(""); setNotice(""); }} onKeyDown={e=>{ if(e.key==="Enter"){ setForgot("email"); setError(""); setNotice(""); } }} style={{ fontSize:12.5 }}>¿Olvidaste tu contraseña?</span>}
            </div>
            <PasswordInput id="f-login-8" className="au-input" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} required />
            {isRegister && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Mínimo 8 caracteres, con letras y números.</p>}
          </div>

          {isRegister && (
            <>
              <div>
                <label htmlFor="f-login-9" style={labelSt}>Celular con WhatsApp</label>
                <PhoneInput id="f-login-9" className="au-input" value={phone} onChange={e=>setPhone(e.target.value)} required />
                <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:6 }}>Te enviaremos un código para verificarlo. También sirve para recuperar tu contraseña.</p>
              </div>
              <div>
                <label style={labelSt}>Tipo de cuenta</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { val:"admin", label:"Administrador", desc:"Control total de la sucursal",
                      icon:<Shield size={20} aria-hidden="true" /> },
                    { val:"tech",  label:"Técnico",        desc:"Gestiona reparaciones asignadas",
                      icon:<Wrench size={20} aria-hidden="true" /> },
                  ].map(opt => {
                    const active = role===opt.val;
                    return (
                      <button key={opt.val} type="button" onClick={()=>setRole(opt.val)} style={{
                        flex:1, padding:"14px 12px", borderRadius:12,
                        border:`1.5px solid ${active?"#0e7490":"var(--border-soft)"}`,
                        background: active?"#ecfeff":"#fff",
                        cursor:"pointer", textAlign:"left", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s",
                      }}>
                        <div style={{ color:active?"#0e7490":"var(--text-muted)", marginBottom:6 }}>{opt.icon}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:active?"#0e7490":"var(--text-primary)", marginBottom:3 }}>{opt.label}</div>
                        <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.4 }}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="f-login-10" style={labelSt}>Sucursal</label>
                <select id="f-login-10" className="au-input" value={branchId} onChange={e=>setBranchId(e.target.value)} required style={{ cursor:"pointer" }}>
                  <option value="">Seleccionar sucursal...</option>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </>
          )}

          <Turnstile onToken={setCaptchaToken} onEnabled={setCaptchaEnabled} resetKey={captchaKey} />

          <button type="submit" className="au-btn" disabled={loading} style={{ cursor: loading ? "wait" : "pointer", marginTop: 4 }}>
            {loading ? (
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.35)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.6s linear infinite", display:"inline-block" }} />
                Procesando...
              </span>
            ) : isRegister ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>

        <div style={{ textAlign:"center", marginTop:22, fontSize:14, color:"var(--text-muted)" }}>
          ¿Eres cliente? <a href="/portal" className="au-link tap-zone" style={{ textDecoration:"none" }}>Consulta tu equipo</a>
        </div>
        </>)}
    </AuthLayout>
  );
}

const labelSt: React.CSSProperties = {
  display:"block", fontSize:14, fontWeight:600, color:"var(--text-primary)", marginBottom:7,
};

/** Logo + nombre. Tocar el logo 5 veces abre el acceso del Super Admin. */
function BrandMark({ logo, name, dark, onSecretTap }: { logo: string | null; name: string; dark?: boolean; onSecretTap: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div onClick={onSecretTap} style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
        {logo ? <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <AppLogo size={36} title="Logo" />}
      </div>
      <b style={{ fontSize: 16, color: dark ? "#fff" : "var(--text-primary)" }}>{name}</b>
    </div>
  );
}

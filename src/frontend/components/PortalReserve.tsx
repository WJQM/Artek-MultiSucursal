"use client";
import { BellRing, CircleCheck, Clock, Joystick, Laptop, Package, ShoppingCart, Store, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Portal: apartar un producto/equipo/consola por unas horas, o anotarse en la lista de espera
// si alguien más ya lo apartó. Todo se decide en el servidor (el primero que llega se lo lleva).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Turnstile } from "@/frontend/components/Turnstile";
import { thumb } from "@/shared/thumb";

export type ResvKind = "inventory" | "equipment" | "console";
export interface Holds { branches: Record<string, number>; inv: Record<string, number>; equipment: string[]; consoles: string[]; maxQty: number }
export const EMPTY_HOLDS: Holds = { branches: {}, inv: {}, equipment: [], consoles: [], maxQty: 3 };

interface Target { kind: ResvKind; id: string; name: string; price: number; image?: string | null; branch?: { id: string; name: string } | null; available: number; hours: number }
interface Done { code: string; until: string; expiresAt: string; total: number; qty: number; whatsapp: boolean; manage: string }

const NAME_KEY = "rt:resv-client";
function remembered(): { name: string; phone: string } {
  try { return JSON.parse(localStorage.getItem(NAME_KEY) || "") || { name: "", phone: "" }; } catch { return { name: "", phone: "" }; }
}
function remember(name: string, phone: string) { try { localStorage.setItem(NAME_KEY, JSON.stringify({ name, phone })); } catch { /* sin almacenamiento */ } }

const money = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    // Tocar afuera no cierra (no se pierde lo escrito): se cierra con ✕ o Esc, como en el resto del sistema
    <div aria-label="Reservar" className="resv-overlay" role="dialog" aria-modal="true">
      <div className="resv-sheet">
        <button type="button" className="resv-x" onClick={onClose} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return <b suppressHydrationWarning>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</b>;
}

/** Botón "Apartar" y su ventana (datos → confirmación). */
export function ReserveButton({ target, maxQty, onChanged }: { target: Target; maxQty: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", qty: 1 });
  const [captcha, setCaptcha] = useState("");
  const [captchaOn, setCaptchaOn] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; taken?: boolean } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const top = Math.max(1, Math.min(maxQty, target.available));

  const show = () => { const r = remembered(); setF({ name: r.name, phone: r.phone, qty: 1 }); setError(null); setDone(null); setOpen(true); };
  const close = () => { setOpen(false); if (done || error?.taken) onChanged(); };

  const submit = async () => {
    if (f.name.trim().length < 2) { setError({ text: "Escribe tu nombre" }); return; }
    if (f.phone.replace(/\D/g, "").length < 8) { setError({ text: "Escribe tu celular de WhatsApp (8 dígitos)" }); return; }
    if (captchaOn && !captcha) { setError({ text: "Espera la verificación de seguridad un momento" }); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/reservations/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: target.kind, itemId: target.id, qty: f.qty, clientName: f.name, clientPhone: f.phone, captchaToken: captcha }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError({ text: d.error || "No se pudo apartar", taken: d.code === "TAKEN" || d.code === "LESS" }); setCaptchaKey((k) => k + 1); return; }
      remember(f.name.trim(), f.phone.trim());
      setDone(d);
    } catch { setError({ text: "Sin conexión. Intenta de nuevo." }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className="resv-btn" onClick={show}><span aria-hidden="true"><ShoppingCart size={14} strokeWidth={STROKE} aria-hidden="true" /></span> Apartar</button>
      {open && (
        <Sheet onClose={close}>
          {!done ? (
            <>
              <h3 className="resv-h"><ShoppingCart size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartar {target.kind === "inventory" ? "producto" : target.kind === "equipment" ? "equipo" : "consola"}</h3>
              <p className="resv-mut">Te lo guardamos <b>{target.hours} horas</b>. Pagas al recogerlo.</p>
              <div className="resv-prod">
                {target.image ? <img src={thumb(target.image, 200)} alt="" /> : <span aria-hidden="true">{target.kind === "equipment" ? <Laptop size={18} strokeWidth={STROKE} aria-hidden="true" /> : target.kind === "console" ? <Joystick size={18} strokeWidth={STROKE} aria-hidden="true" /> : <Package size={18} strokeWidth={STROKE} aria-hidden="true" />}</span>}
                <div><b>{target.name}</b><div className="resv-mut">{money(target.price)}{target.branch ? ` · ${target.branch.name}` : ""}</div></div>
              </div>
              <label className="resv-lbl">Tu nombre<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre y apellido" autoComplete="name" maxLength={80} /></label>
              <label className="resv-lbl">Tu celular (WhatsApp)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Celular" inputMode="tel" autoComplete="tel" maxLength={20} /></label>
              {target.kind === "inventory" && top > 1 && (
                <div className="resv-lbl">Cantidad
                  <div className="resv-qty">
                    <button type="button" onClick={() => setF({ ...f, qty: Math.max(1, f.qty - 1) })} aria-label="Menos">−</button>
                    <b>{f.qty}</b>
                    <button type="button" onClick={() => setF({ ...f, qty: Math.min(top, f.qty + 1) })} aria-label="Más">+</button>
                    <span className="resv-mut">máx. {top} · total {money(target.price * f.qty)}</span>
                  </div>
                </div>
              )}
              <div className="resv-note"><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> Si no lo recoges en <b>{target.hours} horas</b>, el apartado se cancela solo y el producto vuelve a la venta.</div>
              <Turnstile onToken={setCaptcha} onEnabled={setCaptchaOn} resetKey={captchaKey} />
              {error && <div role="alert" className={`resv-err${error.taken ? " taken" : ""}`}>{error.text}{error.taken && <div style={{ marginTop: 6 }}>Cierra esta ventana para ver lo que queda, o pide que te avisemos si se libera.</div>}</div>}
              <button type="button" className="resv-go" disabled={busy} onClick={submit}>{busy ? "Apartando…" : `Apartar por ${target.hours} horas`}</button>
            </>
          ) : (
            <div className="resv-ok">
              <div className="resv-big" aria-hidden="true"><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
              <h3 className="resv-h">¡Listo, está apartado!</h3>
              <div className="resv-code">{done.code}</div>
              <div className="resv-timer"><div>Te lo guardamos por</div><Countdown to={done.expiresAt} /><div>hasta el {done.until}</div></div>
              <div className="resv-sum">{target.name}{done.qty > 1 ? ` × ${done.qty}` : ""} — <b>{money(done.total)}</b>{target.branch ? <><br /><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {target.branch.name}</> : null}<br />Pagas al recogerlo.</div>
              <p className="resv-mut" style={{ marginTop: 10 }}>{done.whatsapp ? "Te enviamos la confirmación por WhatsApp." : "Guarda tu código. Desde este enlace puedes verlo o cancelarlo:"}</p>
              <a className="resv-link" href={done.manage}>Ver mi apartado</a>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

/** "Avisarme si se libera": lista de espera (aviso por WhatsApp al primero de la lista). */
export function WaitlistButton({ kind, id, name }: { kind: ResvKind; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "" });
  const [captcha, setCaptcha] = useState("");
  const [captchaOn, setCaptchaOn] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pos, setPos] = useState<number | null>(null);

  const show = () => { const r = remembered(); setF({ name: r.name, phone: r.phone }); setError(""); setPos(null); setOpen(true); };
  const submit = async () => {
    if (f.phone.replace(/\D/g, "").length < 8) { setError("Escribe tu celular de WhatsApp (8 dígitos)"); return; }
    if (captchaOn && !captcha) { setError("Espera la verificación de seguridad un momento"); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/reservations/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, itemId: id, clientName: f.name, clientPhone: f.phone, captchaToken: captcha }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo guardar"); setCaptchaKey((k) => k + 1); return; }
      if (f.name.trim()) remember(f.name.trim(), f.phone.trim());
      setPos(d.position || 1);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className="resv-wait" onClick={show}><span aria-hidden="true"><BellRing size={14} strokeWidth={STROKE} aria-hidden="true" /></span> <span className="resv-wait-full">Avisarme si se libera</span><span className="resv-wait-short">Avisarme</span></button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          {pos === null ? (
            <>
              <h3 className="resv-h"><BellRing size={14} strokeWidth={STROKE} aria-hidden="true" /> Avisarme si se libera</h3>
              <p className="resv-mut"><b>{name}</b> está apartado por otra persona. Si no lo recoge, te avisamos por WhatsApp para que lo apartes tú.</p>
              <label className="resv-lbl">Tu nombre (opcional)<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre" autoComplete="name" maxLength={80} /></label>
              <label className="resv-lbl">Tu celular (WhatsApp)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Celular" inputMode="tel" autoComplete="tel" maxLength={20} /></label>
              <Turnstile onToken={setCaptcha} onEnabled={setCaptchaOn} resetKey={captchaKey} />
              {error && <div role="alert" className="resv-err">{error}</div>}
              <button type="button" className="resv-go" disabled={busy} onClick={submit}>{busy ? "Guardando…" : "Avisarme por WhatsApp"}</button>
            </>
          ) : (
            <div className="resv-ok">
              <div className="resv-big" aria-hidden="true"><BellRing size={14} strokeWidth={STROKE} aria-hidden="true" /></div>
              <h3 className="resv-h">¡Listo, te avisaremos!</h3>
              <p className="resv-mut" style={{ marginTop: 8 }}>{pos > 1 ? `Eres el número ${pos} en la lista de espera.` : "Eres el primero en la lista de espera."} Si se libera, te llega un WhatsApp para que lo apartes.</p>
              <button type="button" className="resv-go" onClick={() => setOpen(false)}>Entendido</button>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

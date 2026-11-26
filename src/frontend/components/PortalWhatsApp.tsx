"use client";
import { BellRing, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useEffect, useRef, useState } from "react";
import { mouseOnly } from "@/frontend/lib/a11y";

export interface PortalBranch { id: string; name: string; address?: string | null; phone?: string | null; latitude?: number | null; longitude?: number | null; hours?: string | null }

/** Número para wa.me: solo dígitos; a los bolivianos de 8 dígitos les agrega 591. */
export function waNumber(phone: string | null | undefined): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 7) return null;
  if (d.length === 8) return `591${d}`;
  return d;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = waNumber(phone);
  return n ? `https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(text)}` : null; // no wa.me: daña emojis en computadora
}

const WA_GREEN = "#047857";

/** "Central" → "la sucursal Central"; "Sucursal Central" se deja tal cual. */
export const branchLabel = (name: string) => (/^sucursal\b/i.test(name.trim()) ? name.trim() : `la sucursal ${name.trim()}`);

export function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.44-9.43a9.37 9.37 0 0 1 6.67 2.77 9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.28 11.28 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.64l6.04-1.58a11.33 11.33 0 0 0 5.41 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.03" />
    </svg>
  );
}

/** Contactos disponibles: sucursales con teléfono y, si es distinto, el teléfono general de la empresa. */
function contactsOf(branches: PortalBranch[], companyPhone: string | null, companyName: string) {
  const list: { key: string; name: string; detail?: string | null; phone: string }[] = [];
  const seen = new Set<string>();
  for (const b of branches) {
    const n = waNumber(b.phone);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    list.push({ key: b.id, name: b.name, detail: b.address, phone: n });
  }
  const c = waNumber(companyPhone);
  if (c && !seen.has(c)) list.unshift({ key: "empresa", name: companyName || "Atención general", detail: "Línea principal", phone: c });
  return list;
}

/** Botón flotante: con un solo número abre WhatsApp directo; con varios deja elegir la sucursal. */
/** Botón flotante "Escríbenos". `message` reemplaza el saludo del catálogo (ej. en el seguimiento: la orden del cliente). */
export function WhatsAppFab({ branches, companyPhone, companyName, message }: { branches: PortalBranch[]; companyPhone: string | null; companyName: string; message?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Globito "¿Te ayudamos?" solo la primera vez en esta visita
  const [hello, setHello] = useState(false);
  useEffect(() => {
    let seen = true;
    try { seen = !!sessionStorage.getItem("waHello"); } catch {}
    if (seen) return;
    const t = setTimeout(() => { try { sessionStorage.setItem("waHello", "1"); } catch {} setHello(true); }, 0);
    return () => clearTimeout(t);
  }, []);
  const contacts = contactsOf(branches, companyPhone, companyName);
  const greeting = message || `Hola ${companyName || ""}, vi su catálogo en la web y quisiera hacer una consulta.`.replace("Hola ,", "Hola,");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (contacts.length === 0) return null;
  const single = contacts.length === 1 ? waLink(contacts[0].phone, greeting) : null;

  return (
    <div ref={ref} className="wa-fab-in" style={{ position: "fixed", right: 18, bottom: "calc(18px + env(safe-area-inset-bottom))", zIndex: 150, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {open && !single && (
        <div role="menu" aria-label="Elegir sucursal" style={{ width: "min(300px, calc(100vw - 36px))", background: "#ffffff", borderRadius: 16, boxShadow: "0 12px 40px rgba(30,42,58,0.22)", border: "1px solid var(--border-soft)", overflow: "hidden", animation: "waPop 0.16s ease-out" }}>
          <div style={{ padding: "14px 16px", background: WA_GREEN, color: "#fff" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>¿Con qué sucursal quieres hablar?</div>
            <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>Te respondemos por WhatsApp</div>
          </div>
          <div style={{ maxHeight: "50vh", overflowY: "auto", padding: 6 }}>
            {contacts.map((c) => (
              <a key={c.key} role="menuitem" href={waLink(c.phone, greeting)!} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, textDecoration: "none", color: "var(--text-primary)" }}
                onPointerEnter={mouseOnly((e) => (e.currentTarget.style.background = "#f0fdf4"))} onPointerLeave={mouseOnly((e) => (e.currentTarget.style.background = "transparent"))}>
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "50%", background: "rgba(37,211,102,0.12)", color: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}><WaIcon size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{c.name}</span>
                  {c.detail && <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.detail}</span>}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
      {hello && !open && <span className="wa-hello" aria-hidden="true">¿Te ayudamos? Escríbenos</span>}
      {single ? (
        <a href={single} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" title="Escríbenos por WhatsApp" className="wa-fab" style={fabStyle}><WaIcon size={30} /><span className="wa-fab-txt">Escríbenos</span></a>
      ) : (
        <button type="button" aria-label="Escríbenos por WhatsApp" aria-expanded={open} title="Escríbenos por WhatsApp" onClick={() => setOpen((o) => !o)} className="wa-fab" style={{ ...fabStyle, border: "none", cursor: "pointer" }}>
          {open ? <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}><X size={18} strokeWidth={STROKE} aria-hidden="true" /></span> : <><WaIcon size={30} /><span className="wa-fab-txt">Escríbenos</span></>}
        </button>
      )}
      <style>{`@keyframes waPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

const fabStyle: React.CSSProperties = {
  width: 58, height: 58, borderRadius: "50%", background: WA_GREEN, color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 1px 2px rgba(15,23,42,0.06)", textDecoration: "none",
};

/**
 * Botón de WhatsApp de la ficha del portal (PortalSheet): abre el chat de la sucursal del producto
 * (o la línea principal) con el mensaje ya escrito. Sin precio (programas y videojuegos) pregunta el precio.
 */
export function WhatsAppBuy({ product, code, price, branch, branches, companyPhone }: {
  product: string; code?: string | null; price?: number | null;
  branch?: { id: string; name: string } | null; branches: PortalBranch[]; companyPhone: string | null;
}) {
  const branchPhone = branch ? branches.find((b) => b.id === branch.id)?.phone : null;
  const phone = waNumber(branchPhone) ? branchPhone : companyPhone;
  const hasPrice = typeof price === "number" && price > 0;
  let text = `Hola, me interesa ${product}`;
  if (code) text += ` (${code})`;
  if (hasPrice) text += ` de Bs. ${Math.round(price).toLocaleString("es-BO")}`;
  if (branch) text += ` en ${branchLabel(branch.name)}`;
  const href = waLink(phone, `${text}. ${hasPrice ? "¿Sigue disponible?" : "¿Qué precio tiene?"}`);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ps-wa" onClick={(e) => e.stopPropagation()}>
      <WaIcon size={18} /> {hasPrice ? "Consultar por WhatsApp" : "Consultar precio por WhatsApp"}
    </a>
  );
}

/** Enlace compacto para las tarjetas de productos y repuestos (sin ficha de detalle). */
export function WhatsAppMini({ product, price, branch, branches, companyPhone, soldOut = false }: {
  product: string; price?: number | null; branch?: { id: string; name: string } | null;
  branches: PortalBranch[]; companyPhone: string | null;
  /** Producto agotado: el botón pasa a "Avisarme cuando llegue" */
  soldOut?: boolean;
}) {
  const branchPhone = branch ? branches.find((b) => b.id === branch.id)?.phone : null;
  const phone = waNumber(branchPhone) ? branchPhone : companyPhone;
  let text = `Hola, me interesa ${product}`;
  if (typeof price === "number" && price > 0) text += ` de Bs. ${Math.round(price).toLocaleString("es-BO")}`;
  if (branch) text += ` en ${branchLabel(branch.name)}`;
  const href = waLink(phone, soldOut ? `${text}. Vi que está agotado: ¿me avisan cuando llegue?` : `${text}. ¿Sigue disponible?`);
  if (!href) return null;
  if (soldOut) return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="wa-notify"
      style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fdba74", color: "#c2410c", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
      <span aria-hidden="true"><BellRing size={14} strokeWidth={STROKE} aria-hidden="true" /></span> <span className="wa-notify-full">Avisarme cuando llegue</span><span className="wa-notify-short">Avisarme</span>
    </a>
  );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="wa-mini"
      style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.35)", color: "var(--ok)", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
      <WaIcon size={15} /> Consultar
    </a>
  );
}

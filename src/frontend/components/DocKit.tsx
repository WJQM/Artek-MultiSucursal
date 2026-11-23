"use client";
import { Scissors } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Piezas comunes de los documentos (recepción, entrega, cotización, nota de venta, fichas).
// Estilos en globals.css, sección "Documentos impresos y en línea (dk-*)". Hoja carta.
import type { ReactNode } from "react";

export interface DocCompany { companyName: string; slogan?: string | null; logo: string | null; phone?: string | null; address?: string | null; email?: string | null }

/** Tamaño de la hoja al imprimir (siempre carta). */
export function DocPrint({ landscape, margin }: { landscape?: boolean; margin?: string }) {
  return <style>{`@media print { @page { size: letter ${landscape ? "landscape" : "portrait"}; margin: ${margin || (landscape ? "6mm" : "12mm")}; } body { background: #fff !important; } }`}</style>;
}

/** Barra superior (no se imprime). */
export function DocBar({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <div className="dk-bar no-print doc-bar"><span>{title}</span><div>{children}</div></div>;
}

const contact = (s: DocCompany) => [s.phone, s.address].filter(Boolean).join(" · ");

/** Logo solo si el negocio subió una imagen (en gris al imprimir); sin imagen no se dibuja nada. */
function Logo({ s }: { s: DocCompany }) {
  return s.logo ? <span className="dk-logo"><img src={s.logo} alt="" /></span> : null;
}

/** Encabezado de cada copia (hoja horizontal con dos copias). */
export function DocHead({ s, label, code }: { s: DocCompany; icon?: ReactNode; label: string; code: string }) {
  return (
    <div className="dk-head">
      <Logo s={s} />
      <div className="dk-co"><b>{s.companyName}</b>{contact(s) && <small>{contact(s)}</small>}</div>
      <div className="dk-num"><small>{label}</small><b>{code}</b></div>
    </div>
  );
}

/** Encabezado grande de la hoja completa (vertical), en recuadro negro. */
export function DocHero({ s, label, code, sub }: { s: DocCompany; icon?: ReactNode; label: string; code: string; sub?: ReactNode }) {
  return (
    <div className="dk-hero">
      <div className="dk-brand">
        <Logo s={s} />
        <div className="dk-co"><b>{s.companyName}</b>{s.slogan && <small>{s.slogan}</small>}{contact(s) && <small>{contact(s)}</small>}</div>
      </div>
      <div className="dk-doc"><span>{label}</span><b>{code}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/** Título del documento con etiquetas a la derecha (copia, estado, garantía…). */
export function DocTitle({ children, tags = [] }: { children: ReactNode; tags?: { text: ReactNode; warn?: boolean }[] }) {
  return <div className="dk-title"><span>{children}</span>{tags.length > 0 && <em>{tags.map((t, i) => <i key={i} className={t.warn ? "warn" : undefined}>{t.text}</i>)}</em>}</div>;
}

export function DocQr({ src, caption }: { src: string; caption: ReactNode }) {
   
  return <div className="dk-qr">{src ? <img src={src} alt="Código QR" /> : <div className="ph" />}<small>{caption}</small></div>;
}

export function DocBox({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="dk-box"><h4><span aria-hidden="true">{icon}</span>{title}</h4><div className="in">{children}</div></div>;
}

export function DocRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="dk-r"><span>{label}</span><b>{value}</b></div>;
}

export function DocCard({ icon, title, ok, children }: { icon: ReactNode; title: string; ok?: boolean; children: ReactNode }) {
  return <div className={`dk-card${ok ? " ok" : ""}`}><h3><span aria-hidden="true">{icon}</span>{title}</h3><div className="in">{children}</div></div>;
}

/** Hoja horizontal con dos copias iguales y línea de corte. */
export function DocCopies({ render }: { render: (label: string) => ReactNode }) {
  return <DocPair left={render("Copia taller")} right={render("Copia cliente")} />;
}

/** Hoja horizontal partida en dos mitades (pueden ser distintas) con línea de corte. Varias seguidas: una por hoja. */
export function DocPair({ left, right, breakAfter }: { left: ReactNode; right: ReactNode; breakAfter?: boolean }) {
  return (
    <div className="dk-sheet print-content" style={breakAfter ? { breakAfter: "page" } : undefined}>
      <div className="dk-copies">
        <div className="dk-copy">{left}</div>
        <div className="dk-cut"><span><Scissors size={14} strokeWidth={STROKE} aria-hidden="true" /> cortar aquí</span></div>
        <div className="dk-copy">{right}</div>
      </div>
    </div>
  );
}

export function DocSign({ left, right }: { left: string; right: string }) {
  return <div className="dk-sign"><div>{left}</div><div>{right}</div></div>;
}

/** QR generado por el propio sistema (/api/qr), sin servicios externos. */
export const qrSrc = (url: string, size = 300) => (url ? `/api/qr?s=${size}&d=${encodeURIComponent(url)}` : "");
export const bs = (n: number) => `Bs. ${Math.round(Number(n) || 0).toLocaleString("es-BO")}`;

"use client";
import { Camera, ImagePlus, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Piezas comunes de los formularios de agregar/editar (estilo azul oscuro + íconos de línea, ver "Kit de formularios" en globals.css).
import { useEffect, type ReactNode, type MouseEvent } from "react";

/**
 * Clic afuera de una ventana de edición: NO la cierra (se perdía lo escrito sin querer);
 * solo la sacude para indicar que hay que usar la X, Cancelar o Guardar.
 */
export function nudgeOnBackdrop(e: MouseEvent<HTMLElement>) {
  if (e.target !== e.currentTarget) return;
  const box = e.currentTarget.firstElementChild as HTMLElement | null;
  if (box) { box.classList.remove("rt-nudge"); void box.offsetWidth; box.classList.add("rt-nudge"); }
}

/** Ventana de agregar/editar: encabezado azul oscuro, cuerpo con secciones y botones fijos abajo. Esc o la X cierran; un clic afuera no. */
export function FormModal({ icon, title, subtitle, onClose, footer, wide, children }: {
  icon: ReactNode; title: ReactNode; subtitle?: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ox-modal" style={{ position: "fixed" }} onClick={nudgeOnBackdrop}>
      <div className={`ox-sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="ox-mhead">
          <span className="ox-hero-ic" aria-hidden="true">{icon}</span>
          <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ox-mclose" onClick={onClose} aria-label="Cerrar"><X size={18} strokeWidth={STROKE} aria-hidden="true" /></button>
        </div>
        <div className="ox-mbody">{children}</div>
        {footer && <div className="ox-mfoot">{footer}</div>}
      </div>
    </div>
  );
}

/** Sección con ícono en un recuadro gris. `card` = tarjeta blanca grande (páginas); si no, bloque suave (ventanas). */
export function FormSection({ icon, tint, title, hint, card, children }: {
  icon: ReactNode; tint?: string; title: ReactNode; hint?: ReactNode; card?: boolean; children: ReactNode;
}) {
  const head = <><span className="ox-e" style={tint ? { background: tint } : undefined} aria-hidden="true">{icon}</span>{title}{hint && <small>{hint}</small>}</>;
  return card
    ? <section className="ox-card"><h2>{head}</h2>{children}</section>
    : <section className="ox-sec"><h3>{head}</h3>{children}</section>;
}

/** Campo con etiqueta clara, marca de obligatorio y ayuda opcional. */
export function Field({ label, required, hint, children, style }: {
  label: ReactNode; required?: boolean; hint?: ReactNode; children: ReactNode; style?: React.CSSProperties;
}) {
  return (
    <label className="ox-field" style={style}>
      <span className="ox-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {hint && <span className="ox-hint">{hint}</span>}
    </label>
  );
}

/** Fotos con botones de cámara y subir (el input de archivo lo maneja la página). */
export function FormPhotos({ previews, onRemove, onCamera, inputRef, onSelect, uploading }: {
  previews: string[]; onRemove: (idx: number) => void; onCamera?: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>; onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; uploading?: boolean;
}) {
  return (
    <div className="ox-photos">
      {previews.map((preview, idx) => (
        <div key={idx} className="ox-ph">
          { }
          <img src={preview} alt={`Foto ${idx + 1}`} />
          <button type="button" className="x" onClick={() => onRemove(idx)} aria-label={`Quitar foto ${idx + 1}`}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
          {uploading && idx === previews.length - 1 && <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>Subiendo…</div>}
        </div>
      ))}
      {onCamera && <button type="button" className="ox-ph-add" onClick={onCamera}><span className="e" aria-hidden="true"><Camera size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Cámara</button>}
      <button type="button" className="ox-ph-add" onClick={() => inputRef.current?.click()}><span className="e" aria-hidden="true"><ImagePlus size={14} strokeWidth={STROKE} aria-hidden="true" /></span>Subir foto</button>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onSelect} style={{ display: "none" }} />
    </div>
  );
}

/** Estilos en línea equivalentes (para componentes que reciben labelStyle/fieldStyle, como ImeiField). */
export const oxLabelStyle: React.CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 };
export const oxFieldStyle: React.CSSProperties = { width: "100%", height: 46, padding: "0 14px", background: "#fff", border: "1.5px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", fontSize: 15, fontWeight: 500, outline: "none" };

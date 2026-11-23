"use client";
import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** (compatibilidad) los campos siempre son claros */
  dark?: boolean;
};

const EYE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EYE_OFF = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19" /><path d="M6.61 6.61A17.5 17.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;

/** Campo de contraseña con el botón del ojito para mostrarla u ocultarla */
export function PasswordInput({ dark: _dark, style, className, ...rest }: Props) {
  const [show, setShow] = useState(false);
  // Lo que ubica el campo dentro de su fila (flex, ancho mínimo…) va en el contenedor
  const { flex, minWidth, width, margin, marginTop, marginBottom, ...inputStyle } = (style || {}) as React.CSSProperties;
  return (
    <div style={{ position: "relative", flex, minWidth: minWidth ?? 0, width: width ?? (flex ? undefined : "100%"), margin, marginTop, marginBottom }}>
      <input
        {...rest}
        className={className}
        type={show ? "text" : "password"}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...inputStyle, width: "100%", paddingRight: 46, boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={0}
        style={{
          position: "absolute", top: "50%", right: 6, transform: "translateY(-50%)",
          width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", padding: 0,
          // Los campos del sistema siempre son claros (también en /setup)
          color: show ? "var(--accent-dim)" : "#6b7a90",
          overflow: "visible",
        }}
      >
        {show ? EYE_OFF : EYE}
      </button>
    </div>
  );
}

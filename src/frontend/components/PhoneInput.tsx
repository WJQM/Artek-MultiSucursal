"use client";
import type { InputHTMLAttributes } from "react";

/**
 * Celular boliviano: muestra "+591" fijo a la izquierda para indicar el formato sin un número de ejemplo.
 * Lo escrito se guarda tal cual (8 dígitos); el servidor agrega el 591 al normalizar.
 */
export function PhoneInput({ style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ position: "relative" }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 15, pointerEvents: "none" }}>+591</span>
      <input type="tel" inputMode="tel" autoComplete="tel-national" {...rest} style={{ ...style, paddingLeft: 58 }} />
    </div>
  );
}

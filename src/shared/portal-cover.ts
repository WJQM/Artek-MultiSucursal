import type { CSSProperties } from "react";

// Foto de portada del portal: "cover" la agranda hasta llenar la franja (recorta), "contain" la muestra
// entera a la derecha. El sombreado usa el color Oscuro de Configuración › Colores.
export type CoverFit = "cover" | "contain";

export const esCoverFit = (v: unknown): v is CoverFit => v === "cover" || v === "contain";

const sombra = (p: number) => `color-mix(in srgb, var(--brand-dark) ${p}%, transparent)`;

export function coverBackground(url: string, fit: CoverFit = "cover"): CSSProperties {
  return {
    backgroundColor: "var(--brand-dark)",
    backgroundImage: `linear-gradient(90deg, ${sombra(90)} 0%, ${sombra(72)} 40%, ${sombra(30)} 100%), url("${url}")`,
    backgroundSize: fit === "contain" ? "cover, contain" : "cover",
    backgroundPosition: fit === "contain" ? "center, right center" : "center",
    backgroundRepeat: "no-repeat",
  };
}

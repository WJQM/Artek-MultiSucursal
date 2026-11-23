import type { CSSProperties } from "react";

// Foto de portada del portal: "cover" la agranda hasta llenar la franja (recorta), "contain" la muestra
// entera a la derecha. El sombreado usa el color Oscuro de Configuración › Colores.
export type CoverFit = "cover" | "contain";
export type PortalNav = "light" | "dark";

export const esCoverFit = (v: unknown): v is CoverFit => v === "cover" || v === "contain";
export const esPortalNav = (v: unknown): v is PortalNav => v === "light" || v === "dark";

const sombra = (p: number) => `color-mix(in srgb, var(--brand-dark) ${p}%, transparent)`;

/** Vista previa en Configuración (foto de computadora). */
export function coverBackground(url: string, fit: CoverFit = "cover"): CSSProperties {
  return {
    backgroundColor: "var(--brand-dark)",
    backgroundImage: `linear-gradient(90deg, ${sombra(90)} 0%, ${sombra(72)} 40%, ${sombra(30)} 100%), url("${url}")`,
    backgroundSize: fit === "contain" ? "cover, contain" : "cover",
    backgroundPosition: fit === "contain" ? "center, right center" : "center",
    backgroundRepeat: "no-repeat",
  };
}

/** Portada del portal: variables que usa .pt-hero2.has-cover en globals.css (en celular, la foto vertical si hay). */
export function coverVars(url: string, fit: CoverFit = "cover", movil?: string | null): CSSProperties {
  return {
    "--pt-cover": `url("${url}")`,
    "--pt-cover-m": `url("${movil || url}")`,
    "--pt-cover-size": fit === "contain" ? "cover, contain" : "cover",
    "--pt-cover-pos": fit === "contain" ? "center, right center" : "center",
  } as CSSProperties;
}

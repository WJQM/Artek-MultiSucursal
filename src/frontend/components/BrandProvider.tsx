"use client";
// Datos de la empresa que el servidor ya conoce al armar la página (layout.tsx): nombre,
// logo y ciudad. Así el menú lateral sale con el logo correcto desde el primer momento,
// sin mostrar el ícono por defecto mientras descarga los ajustes.
import { createContext, useContext, type ReactNode } from "react";

/** logo: dirección del ícono generado por /api/brand/icon (liviano), o null si no hay logo */
export interface Brand { companyName: string; logo: string | null; city: string | null }

const BrandContext = createContext<Brand>({ companyName: "", logo: null, city: null });

export function BrandProvider({ value, children }: { value: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);

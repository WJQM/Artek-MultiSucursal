"use client";
// El catálogo llega con la página desde el layout (sin parpadeo); Configuración lo actualiza al guardar
import { createContext, useContext, useState, type ReactNode } from "react";
import { CATALOGO_DEFAULT, type CatalogoRecepcion } from "@/shared/recepcion";

interface Ctx { catalogo: CatalogoRecepcion; setCatalogo: (c: CatalogoRecepcion) => void }

const RecepcionContext = createContext<Ctx>({ catalogo: CATALOGO_DEFAULT, setCatalogo: () => {} });

export function RecepcionProvider({ value, children }: { value: CatalogoRecepcion; children: ReactNode }) {
  const [catalogo, setCatalogo] = useState(value);
  return <RecepcionContext.Provider value={{ catalogo, setCatalogo }}>{children}</RecepcionContext.Provider>;
}

export const useRecepcion = () => useContext(RecepcionContext);

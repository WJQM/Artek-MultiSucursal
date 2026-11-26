// Resumen corto de un equipo para tarjetas y fichas: "i5-12500H · 16 GB · RTX 3050 · SSD 512 GB".
// Se usa en el portal (catálogo y ficha) y en la pantalla de Equipos del sistema.
export const cortoCpu = (t: string) => t.replace(/^(intel|amd)s+/i, "").replace(/^(core|ryzen)s+/i, (m) => (/ryzen/i.test(m) ? m : "")).replace(/s*(.*?)/g, "").trim();
export const cortoRam = (t: string) => t.match(/d+s*GB/i)?.[0].replace(/s+/, " ") || t;
export const cortoGpu = (t: string) => t.replace(/^(nvidia|amd|intel)s+(geforces+|radeons+)?/i, "").trim();

interface EquipoResumible { processor?: string | null; ram?: string | null; graphicsCard?: string | null; storage?: string | null }

/** Procesador, RAM, gráficos y disco principal; omite los datos vacíos */
export function resumenEquipo(e: EquipoResumible): string {
  return [e.processor && cortoCpu(e.processor), e.ram && cortoRam(e.ram), e.graphicsCard && cortoGpu(e.graphicsCard), e.storage]
    .filter((x): x is string => !!x && !!x.trim()).join(" · ");
}

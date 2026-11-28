// Listas compartidas por "Nueva orden" y "Editar orden" (misma presentación en las dos pantallas).

// Los tipos de equipo y la lista de accesorios ahora son configurables (src/shared/recepcion.ts); esto queda solo
// para saber qué accesorios de órdenes antiguas pedían detalle
export const ACCESSORIES_HINTS: Record<string, string> = {
  "Cargador": "Ej: 65W, USB-C, modelo...", "Batería": "Ej: 6 celdas, modelo...", "Disco Duro": "Ej: 500GB SSD, 1TB HDD...",
  "Memoria RAM": "Ej: 8GB DDR4, 16GB DDR5...", "Cable de Poder": "Ej: 3 pines, tipo...", "Pantalla": "Ej: 15.6\", táctil...",
  "Tornillos": "Ej: completo, incompleto, cantidad...", "Maletín/Bolsa": "Ej: color, tamaño...", "Otros": "Especificar qué accesorios...",
};

export const PRIORITIES = [{ value: "media", label: "Normal", color: "#047857" }, { value: "alta", label: "Alta", color: "#ea580c" }, { value: "urgente", label: "Urgente", color: "#dc2626" }];

export const TECH_COLORS = ["#2563eb", "#7c3aed", "#0e7c86", "#b45309", "#be185d", "#047857"];

export const initials = (name: string) => name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

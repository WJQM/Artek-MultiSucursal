import { redirect } from "next/navigation";

// Repuestos ahora es un filtro dentro de Inventario; se conserva la ruta para enlaces guardados
export default function RepuestosPage() {
  redirect("/inventory?tipo=part");
}

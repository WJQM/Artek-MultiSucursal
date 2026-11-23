"use client";
import { Toaster } from "@/frontend/components/Toaster";
import { DialogHost } from "@/frontend/components/DialogHost";

// Avisos del sistema (debajo de la campana o del encabezado), confirmaciones y comportamiento común de las ventanas
export default function ToastProvider() {
  return <><Toaster /><DialogHost /></>;
}

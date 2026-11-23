"use client";
// Dirección pública del sistema en el navegador: la de Configuración ("Enlace público")
// o, si está vacía, el dominio desde donde se abrió la página.
// Se usa en los QR impresos y en los mensajes de WhatsApp armados en pantalla.
import { normalizePublicUrl } from "@/shared/branding";

let pending: Promise<string> | null = null;

export function publicBase(): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("");
  if (!pending) {
    pending = fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => normalizePublicUrl(s?.publicUrl) || window.location.origin)
      .catch(() => window.location.origin);
  }
  return pending;
}

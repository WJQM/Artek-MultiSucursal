/**
 * Botón "Cerrar" de las hojas de documentos (OT, CE, COT/NV, certificados, fichas…).
 * window.close() solo funciona si la pestaña la abrió el sistema; si se llegó escaneando un QR
 * o desde un enlace, el navegador lo ignora y el botón "no hacía nada". Ahora:
 *  1. si la abrió el sistema → se cierra,
 *  2. si no, vuelve a la pantalla anterior,
 *  3. y si no hay anterior, va al panel (personal) o al portal (clientes).
 */
export function closePage() {
  if (typeof window === "undefined") return;
  const fallback = () => {
    let staff = false;
    try { staff = !!sessionStorage.getItem("token"); } catch {}
    window.location.href = staff ? "/dashboard" : "/portal";
  };
  if (window.opener && !window.opener.closed) {
    window.close();
    setTimeout(() => { if (window.closed) return; if (history.length > 1) history.back(); else fallback(); }, 200);
    return;
  }
  // Se llegó desde otra pantalla del sistema (p. ej. escaneando en el portal) → volver ahí
  let fromHere = false;
  try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch {}
  if (fromHere && history.length > 1) {
    const here = location.href;
    history.back();
    setTimeout(() => { if (location.href === here) fallback(); }, 400);
    return;
  }
  fallback();
}

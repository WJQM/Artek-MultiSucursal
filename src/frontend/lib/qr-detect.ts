/**
 * Reconoce qué documento es un QR escaneado (o un código escrito a mano).
 * Lo usan el escáner del personal y el del portal, así ambos entienden los mismos QR.
 *
 * QR que imprime el sistema:
 *   OT  → /track/OT-1                   CE → /delivery/view/OT-1 (o /delivery/OT-1)
 *   COT/NV → /quotations/print/COT-1     CL → /certificate-view/CL-1
 *   Equipo → /portal?eq=ID  o  /equipment/print/ID      Consola → /portal?cn=ID  o  /consoles/print/ID
 *   Programa → /portal?sw=ID   Videojuego → /portal?vg=ID   Producto → /portal?branchId=…
 * y los códigos escritos: OT-1, CE-1, COT-1, NV-1, CL-1, EQ-1, CN-1.
 */
export type QRType = "track" | "delivery" | "quotation" | "sale" | "certificate" | "equipment" | "console" | "software" | "videogame" | "portal" | "url";
export interface QRResult { type: QRType; code: string; branchId?: string }

const seg = (path: string, prefix: string) => {
  const rest = path.slice(prefix.length).split("/").filter(Boolean)[0] || "";
  return decodeURIComponent(rest);
};
const quoteType = (code: string): QRType => (code.toUpperCase().startsWith("NV") ? "sale" : "quotation");

export function detectQR(text: string): QRResult {
  const t = text.trim();

  // ¿Es un enlace? (con o sin https://)
  let url: URL | null = null;
  if (/^https?:\/\//i.test(t)) { try { url = new URL(t); } catch { url = null; } }
  else if (t.startsWith("/")) { try { url = new URL(t, "https://x.local"); } catch { url = null; } }

  if (url) {
    const p = url.pathname.replace(/\/+$/, "");
    const q = url.searchParams;
    const branchId = q.get("branchId") || undefined;
    if (p.startsWith("/track/")) return { type: "track", code: seg(p, "/track/").toUpperCase(), branchId };
    // El comprobante apunta a /delivery/view/OT-1 (antes el escáner leía "view/OT-1" y no encontraba nada)
    if (p.startsWith("/delivery/view/")) return { type: "delivery", code: seg(p, "/delivery/view/").toUpperCase(), branchId };
    if (p.startsWith("/delivery/")) return { type: "delivery", code: seg(p, "/delivery/").toUpperCase(), branchId };
    if (p.startsWith("/certificate-view/")) return { type: "certificate", code: seg(p, "/certificate-view/").toUpperCase(), branchId };
    if (p.startsWith("/quotations/print/")) { const c = seg(p, "/quotations/print/"); return { type: quoteType(c), code: c, branchId }; }
    if (p === "/quotations" && q.get("view")) { const c = q.get("view")!; return { type: quoteType(c), code: c, branchId }; }
    if (p.startsWith("/equipment/print/")) return { type: "equipment", code: seg(p, "/equipment/print/"), branchId };
    if (p.startsWith("/consoles/print/")) return { type: "console", code: seg(p, "/consoles/print/"), branchId };
    if (q.get("eq")) return { type: "equipment", code: q.get("eq")!, branchId };
    if (q.get("cn")) return { type: "console", code: q.get("cn")!, branchId };
    if (q.get("sw")) return { type: "software", code: q.get("sw")!, branchId };
    if (q.get("vg")) return { type: "videogame", code: q.get("vg")!, branchId };
    if (p === "/portal" || p === "") return { type: "portal", code: "", branchId };
    // Otro enlace del sistema: se abre tal cual
    return { type: "url", code: url.pathname + url.search, branchId };
  }

  const upper = t.toUpperCase().replace(/\s+/g, "");
  if (upper.startsWith("EQ-")) return { type: "equipment", code: upper };
  if (upper.startsWith("CN-")) return { type: "console", code: upper };
  if (upper.startsWith("CE-")) return { type: "delivery", code: `OT-${upper.slice(3)}` };
  if (upper.startsWith("AE-")) return { type: "delivery", code: `OT-${upper.slice(3)}` }; // compatibilidad
  if (upper.startsWith("CL-")) return { type: "certificate", code: upper };
  if (upper.startsWith("COT-")) return { type: "quotation", code: upper };
  if (upper.startsWith("NV-")) return { type: "sale", code: upper };
  return { type: "track", code: upper };
}

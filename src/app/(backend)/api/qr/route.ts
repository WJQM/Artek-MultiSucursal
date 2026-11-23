import QRCode from "qrcode";

// GET /api/qr?d=<texto>&s=<px> — código QR en SVG generado por el propio sistema.
// Antes los documentos usaban api.qrserver.com: tardaba en aparecer, sin internet quedaba vacío
// y los enlaces de los clientes pasaban por ese servicio. El SVG se ve nítido al imprimir.
const MAX_LEN = 1500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = url.searchParams.get("d") || "";
  const size = Math.min(Math.max(parseInt(url.searchParams.get("s") || "300") || 300, 64), 1000);
  if (!data || data.length > MAX_LEN) return new Response("Texto inválido", { status: 400 });

  try {
    const svg = await QRCode.toString(data, { type: "svg", margin: 2, width: size, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // El mismo texto siempre da el mismo QR: el navegador lo guarda
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No se pudo generar el QR", { status: 400 });
  }
}

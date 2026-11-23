// Propone los dos colores de la marca a partir de la foto de portada:
// - Oscuro: el tono de las partes oscuras de la foto (el fondo), bien oscuro para que el texto blanco se lea.
// - Principal: el color vivo que más aparece (el rojo de un logo, por ejemplo).
// Se calcula en el navegador con una copia chiquita de la foto (la foto es del propio sistema: /uploads/…).
export async function coloresDeFoto(url: string): Promise<{ dark: string; accent: string | null } | null> {
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return null; }
  const lado = 96;
  const cv = document.createElement("canvas");
  cv.width = lado; cv.height = lado;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, lado, lado);
  const px = ctx.getImageData(0, 0, lado, lado).data;

  let dr = 0, dg = 0, db = 0, dn = 0;
  const bins = Array.from({ length: 24 }, () => ({ peso: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const [h, s, l] = rgbAHsl(r, g, b);
    if (l < 0.3) { dr += r; dg += g; db += b; dn++; }
    if (s > 0.45 && l > 0.25 && l < 0.75) {
      const bin = bins[Math.floor(h / 15) % 24];
      bin.peso += s; bin.r += r * s; bin.g += g * s; bin.b += b * s;
    }
  }

  let dark: string;
  if (dn > 0) {
    const [h, s] = rgbAHsl(dr / dn, dg / dn, db / dn);
    dark = hslAHex(h, Math.min(s, 0.6), 0.1);
  } else {
    dark = "#0f172a";
  }
  const mejor = bins.reduce((a, b) => (b.peso > a.peso ? b : a));
  const accent = mejor.peso > lado * lado * 0.01 ? aHex(mejor.r / mejor.peso, mejor.g / mejor.peso, mejor.b / mejor.peso) : null;
  return { dark, accent };
}

function rgbAHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslAHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return aHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function aHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

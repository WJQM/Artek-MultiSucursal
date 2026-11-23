import { readFile, writeFile, mkdir, rename, stat } from "fs/promises";
import path from "path";
import { uploadDir, uploadPath } from "@/backend/uploads";
import { THUMB_WIDTHS } from "@/shared/thumb";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Content-Type": "image/webp",
  // El nombre de la foto nunca cambia de contenido: el navegador la guarda un año
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

// GET /api/thumb?src=/uploads/foto.jpg&w=400 — miniatura liviana (WebP) de una foto subida.
// Las tarjetas del portal muestran la foto a ~200 px; antes se descargaba la original (a veces 3–4 MB).
// Se genera una sola vez y queda guardada en uploads/_thumbs/<ancho>/.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get("src") || "";
  const w = parseInt(url.searchParams.get("w") || "0");
  const original = uploadPath(src);
  if (!original || !src.startsWith("/uploads/") || !(THUMB_WIDTHS as readonly number[]).includes(w)) {
    return new Response("No encontrado", { status: 404 });
  }
  const name = path.basename(original).replace(/\.[a-z0-9]+$/i, "") + ".webp";
  const dir = path.join(uploadDir(), "_thumbs", String(w));
  const cached = path.join(dir, name);

  try {
    const data = await readFile(cached);
    return new Response(new Uint8Array(data), { headers: { ...CACHE_HEADERS, "Content-Length": String(data.length) } });
  } catch { /* todavía no existe */ }

  try {
    if (!(await stat(original)).isFile()) throw new Error("no file");
    const sharp = (await import("sharp")).default;
    const out = await sharp(original, { failOn: "none", animated: false })
      .rotate()
      .resize({ width: w, height: w, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await mkdir(dir, { recursive: true });
    const tmp = `${cached}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, out);
    await rename(tmp, cached);
    return new Response(new Uint8Array(out), { headers: { ...CACHE_HEADERS, "Content-Length": String(out.length) } });
  } catch {
    // Si no se puede reducir, se manda a la foto original
    return new Response(null, { status: 302, headers: { Location: src } });
  }
}

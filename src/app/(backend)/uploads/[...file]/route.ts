import { readFile, stat } from "fs/promises";
import { uploadPath, UPLOAD_TYPES } from "@/backend/uploads";

export const dynamic = "force-dynamic";

// GET /uploads/<archivo> — sirve las imágenes subidas (también las subidas después de compilar)
export async function GET(_request: Request, context: { params: Promise<{ file: string[] }> }) {
  const { file } = await context.params;
  const parts: string[] = Array.isArray(file) ? file : [file];
  if (parts.length !== 1) return new Response("No encontrado", { status: 404 });
  const p = uploadPath(parts[0]);
  const ext = parts[0].split(".").pop()?.toLowerCase() || "";
  const type = UPLOAD_TYPES[ext];
  if (!p || !type) return new Response("No encontrado", { status: 404 });
  try {
    const info = await stat(p);
    if (!info.isFile()) return new Response("No encontrado", { status: 404 });
    const data = await readFile(p);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        // El nombre lleva fecha + aleatorio: nunca cambia de contenido
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}

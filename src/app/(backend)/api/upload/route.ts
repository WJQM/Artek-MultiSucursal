import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { uploadDir } from "@/backend/uploads";
import { randomBytes } from "crypto";
import path from "path";
import { getUserFromToken } from "@/backend/auth";
import { rateLimit, getClientIp } from "@/backend/rate-limit";

const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Detecta el tipo real de imagen leyendo los primeros bytes del archivo.
 * La extensión se decide aquí, nunca a partir del nombre que manda el navegador,
 * así no se pueden subir .html/.svg/.js disfrazados de imagen.
 */
function detectImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

/**
 * Vuelve a codificar la imagen: aplica la rotación del celular y quita los metadatos
 * (ubicación GPS, modelo del teléfono, fecha) y reduce las fotos muy grandes. Los GIF se guardan tal cual (pueden ser animados).
 */
async function stripMetadata(buf: Buffer, ext: string): Promise<Buffer> {
  if (ext === "gif") return buf;
  const sharp = (await import("sharp")).default;
  // También se limita a 2000 px por lado: una foto de celular (4000 px, 3–5 MB) queda en ~300–600 KB
  // y se sigue viendo nítida al hacer zoom.
  const img = sharp(buf, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
  if (ext === "jpg") return img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  if (ext === "png") return img.png().toBuffer();
  if (ext === "webp") return img.webp({ quality: 85 }).toBuffer();
  return img.avif({ quality: 60 }).toBuffer();
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);

  // Sin sesión solo se permite subir la foto de perfil al registrarse, con límite estricto
  const ip = getClientIp(request);
  const rl = user
    ? rateLimit(`upload:user:${user.id}`, 200, 60 * 60_000)
    : rateLimit(`upload:anon:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas subidas, intenta más tarde" }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La imagen no debe superar 5MB" }, { status: 400 });
    }

    const original = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExt(original);
    if (!ext) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG, WEBP, GIF o AVIF" }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = await stripMetadata(original, ext);
    } catch {
      return NextResponse.json({ error: "La imagen está dañada o no se puede leer" }, { status: 400 });
    }

    const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), buffer);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}

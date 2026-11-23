// Carpeta de archivos subidos (fotos de usuarios, productos, equipos, logo…).
// Next.js en producción solo sirve lo que había en /public al compilar, así que las subidas
// se guardan aquí y se sirven con la ruta /uploads/[...file] (src/app/(backend)/uploads/[...file]/route.ts).
// En el servidor conviene una carpeta FUERA del proyecto para que sobreviva a cada actualización:
//   UPLOAD_DIR="/var/www/repairtrack-uploads"
import path from "path";

export function uploadDir(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  return env ? path.resolve(env) : path.join(process.cwd(), "public", "uploads");
}

/** Ruta en disco de un "/uploads/archivo.ext" (o null si el nombre no es válido) */
export function uploadPath(urlOrName: string): string | null {
  const name = urlOrName.replace(/^\/?uploads\//, "");
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(name) || name.startsWith(".")) return null;
  return path.join(uploadDir(), name);
}

export const UPLOAD_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif",
};

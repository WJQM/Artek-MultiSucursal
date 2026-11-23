import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { getJwtSecret } from "./jwt-secret";

/** Clave para cifrar datos sensibles en la base (secreto de la app autenticadora). */
function encKey(): Buffer {
  const base = process.env.ENCRYPTION_KEY || getJwtSecret();
  return createHash("sha256").update(base + "|rt-enc-v1").digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(enc: string): string | null {
  try {
    const [v, iv, tag, data] = enc.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Hash con "pimienta" del servidor (para PIN, códigos de respaldo y tokens de dispositivo). */
export function pepperHash(value: string): string {
  return createHmac("sha256", getJwtSecret()).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += randomInt(0, 10).toString();
  return s;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Contraseña temporal legible (sin 0/O/1/l). Siempre tiene letras y números (cumple validatePassword). */
export function randomPassword(len = 10): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const chars = letters + digits;
  const pick = (set: string) => set[randomInt(0, set.length)];
  const out = [pick(letters), pick(digits)];
  while (out.length < Math.max(len, 8)) out.push(pick(chars));
  for (let i = out.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join("");
}

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (pw.length > 128) return "La contraseña es demasiado larga";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "La contraseña debe tener letras y números";
  return null;
}

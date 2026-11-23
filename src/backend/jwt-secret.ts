// Secreto JWT compartido por las rutas API (Node) y el middleware (Edge).
// Sin dependencias para poder importarse desde ambos entornos.
//
// Ya no existe un valor por defecto: si JWT_SECRET falta en el .env,
// cualquiera podría firmar tokens con la clave pública del repositorio.

const MIN_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET no está configurado o es demasiado corto (mínimo ${MIN_LENGTH} caracteres). ` +
      `Genera uno con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return secret;
}

// Ayudas para leer errores atrapados en catch (sin usar `any`)
export type ErrLike = { message?: string; code?: string; name?: string; meta?: unknown };

/** Texto del error, venga como venga */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as ErrLike).message ?? "");
  return String(e);
}

/** El error como objeto con code/name/message opcionales */
export const errOf = (e: unknown): ErrLike => (e && typeof e === "object" ? (e as ErrLike) : {});

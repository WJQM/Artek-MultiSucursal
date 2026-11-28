// Lectura y guardado del catálogo de recepción en KeyValue (no es secreto: entra en los respaldos)
import { readKV, writeKV } from "@/backend/automation";
import { normalizeCatalogo, type CatalogoRecepcion } from "@/shared/recepcion";

const KEY = "recepcion:catalogo";

export async function getCatalogo(): Promise<CatalogoRecepcion> {
  return normalizeCatalogo(await readKV<unknown>(KEY, null));
}

export async function saveCatalogo(raw: unknown): Promise<CatalogoRecepcion> {
  const c = normalizeCatalogo(raw);
  await writeKV(KEY, c);
  return c;
}

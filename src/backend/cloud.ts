// Copia de los respaldos en la nube (Cloudflare R2 o cualquier almacenamiento compatible con S3).
// Después de cada respaldo:
//   respaldos/db_AAAA-MM-DD_HHMM.dump   → la base de datos (se borran las de más de N días)
//   fotos/<archivo>                     → cada foto una sola vez (los nombres nunca cambian), así no se repiten 200 MB cada día
// La configuración (con la clave secreta) se guarda en KeyValue "cloud:config"; la clave nunca se devuelve al navegador.
import fs from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand, type _Object } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { readKV, writeKV } from "./automation";
import { uploadDir } from "./uploads";

export interface CloudConfig {
  enabled: boolean;
  /** Account ID de Cloudflare (o una dirección https completa de otro servicio compatible con S3) */
  account: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Días que se guardan las copias de la base de datos en la nube */
  keepDays: number;
  /** Subir también las fotos */
  photos: boolean;
}
export interface CloudStatus {
  at: string; ok: boolean; error?: string;
  dbFile?: string; dbSize?: number; photosUploaded?: number; photosTotal?: number; deleted?: number;
}

const KEY = "cloud:config";
const STATUS_KEY = "cloud:last";
const DEFAULT: CloudConfig = { enabled: false, account: "", bucket: "", accessKeyId: "", secretAccessKey: "", keepDays: 30, photos: true };

export async function getCloudConfig(): Promise<CloudConfig> {
  return { ...DEFAULT, ...(await readKV<Partial<CloudConfig>>(KEY, {})) };
}

/** Lo que ve el navegador: la clave secreta solo como "guardada / no guardada". */
export async function publicCloudConfig() {
  const c = await getCloudConfig();
  const { secretAccessKey, ...rest } = c;
  return { ...rest, hasSecret: !!secretAccessKey, ready: isReady(c) };
}

const isReady = (c: CloudConfig) => !!(c.account && c.bucket && c.accessKeyId && c.secretAccessKey);

export async function saveCloudConfig(input: Record<string, unknown>) {
  const cur = await getCloudConfig();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const next: CloudConfig = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : cur.enabled,
    account: str(input.account, 300) ?? cur.account,
    bucket: (str(input.bucket, 63) ?? cur.bucket).toLowerCase(),
    accessKeyId: str(input.accessKeyId, 200) ?? cur.accessKeyId,
    // Vacío = no cambiar la clave guardada
    secretAccessKey: str(input.secretAccessKey, 300) || cur.secretAccessKey,
    keepDays: [7, 14, 30, 60, 90].includes(Number(input.keepDays)) ? Number(input.keepDays) : cur.keepDays,
    photos: typeof input.photos === "boolean" ? input.photos : cur.photos,
  };
  if (next.bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(next.bucket)) throw new Error("Nombre de bucket inválido (solo minúsculas, números y guiones)");
  if (next.account && !endpointOf(next.account)) throw new Error("Account ID inválido");
  await writeKV(KEY, next);
  return publicCloudConfig();
}

/** Account ID de Cloudflare → endpoint de R2. También acepta una dirección https completa (otro proveedor S3). */
function endpointOf(account: string): string | null {
  const a = account.trim().replace(/\/+$/, "");
  if (/^[a-f0-9]{32}$/i.test(a)) return `https://${a}.r2.cloudflarestorage.com`;
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(a)) return a;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(a)) return a; // solo pruebas locales
  const m = /^https:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com/i.exec(a);
  return m ? `https://${m[1]}.r2.cloudflarestorage.com` : null;
}

function client(c: CloudConfig) {
  return new S3Client({
    region: "auto",
    endpoint: endpointOf(c.account) || undefined,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    forcePathStyle: true,
  });
}

/** Mensaje entendible a partir del error del proveedor. */
function explain(e: unknown): string {
  const err = e as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const code = err?.name || err?.Code || "";
  const status = err?.$metadata?.httpStatusCode;
  if (code === "NoSuchBucket" || status === 404) return "No existe ese bucket. Revisa el nombre (o créalo en Cloudflare › R2).";
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch" || status === 403 || status === 401) return "Las claves no son correctas o no tienen permiso de escritura en ese bucket.";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(err?.message || "")) return "No se encontró el servicio. Revisa el Account ID.";
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(err?.message || "")) return "No se pudo conectar con la nube (sin internet o bloqueado).";
  return (err?.message || String(e)).slice(0, 200);
}

export async function testCloud(): Promise<{ ok: boolean; error?: string }> {
  const c = await getCloudConfig();
  if (!isReady(c)) return { ok: false, error: "Completa Account ID, bucket y las dos claves" };
  try {
    await client(c).send(new HeadBucketCommand({ Bucket: c.bucket }));
    // Prueba real de escritura y borrado
    const s3 = client(c);
    await new Upload({ client: s3, params: { Bucket: c.bucket, Key: "respaldos/.prueba", Body: "ok" } }).done();
    await s3.send(new DeleteObjectsCommand({ Bucket: c.bucket, Delete: { Objects: [{ Key: "respaldos/.prueba" }] } }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

async function listAll(s3: S3Client, bucket: string, prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    out.push(...(r.Contents || []));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

const uploadFile = (s3: S3Client, bucket: string, key: string, file: string) =>
  new Upload({ client: s3, params: { Bucket: bucket, Key: key, Body: fs.createReadStream(file) }, queueSize: 3, partSize: 16 * 1024 * 1024 }).done();

/**
 * Sube a la nube el respaldo indicado (o el más reciente) y las fotos nuevas, y borra copias viejas.
 * Nunca lanza error: devuelve el resultado y lo guarda para mostrarlo en Configuración.
 */
export async function uploadToCloud(dbPath: string | null): Promise<CloudStatus> {
  const c = await getCloudConfig();
  const status: CloudStatus = { at: new Date().toISOString(), ok: false };
  try {
    if (!isReady(c)) throw new Error("La copia en la nube no está configurada");
    if (!dbPath || !fs.existsSync(dbPath)) throw new Error("No se encontró el archivo del respaldo");
    const s3 = client(c);

    const dbName = path.basename(dbPath);
    await uploadFile(s3, c.bucket, `respaldos/${dbName}`, dbPath);
    status.dbFile = dbName;
    status.dbSize = fs.statSync(dbPath).size;

    if (c.photos) {
      const dir = uploadDir();
      let names: string[] = [];
      try { names = fs.readdirSync(dir).filter((n) => !n.startsWith(".") && fs.statSync(path.join(dir, n)).isFile()); } catch {}
      const there = new Set((await listAll(s3, c.bucket, "fotos/")).map((o) => o.Key));
      const missing = names.filter((n) => !there.has(`fotos/${n}`));
      for (const n of missing) await uploadFile(s3, c.bucket, `fotos/${n}`, path.join(dir, n));
      status.photosUploaded = missing.length;
      status.photosTotal = names.length;
    }

    // Copias de la base de datos más viejas que keepDays
    const limit = Date.now() - c.keepDays * 86_400_000;
    const old = (await listAll(s3, c.bucket, "respaldos/")).filter((o) => o.Key && /db_.*\.dump$/.test(o.Key) && o.LastModified && o.LastModified.getTime() < limit);
    for (let i = 0; i < old.length; i += 900) {
      await s3.send(new DeleteObjectsCommand({ Bucket: c.bucket, Delete: { Objects: old.slice(i, i + 900).map((o) => ({ Key: o.Key! })) } }));
    }
    status.deleted = old.length;
    status.ok = true;
  } catch (e) {
    status.error = explain(e);
    console.error("[Nube]", e);
  }
  await writeKV(STATUS_KEY, status);
  return status;
}

export async function cloudStatus(): Promise<CloudStatus | null> {
  return readKV<CloudStatus | null>(STATUS_KEY, null);
}

/** Lo que hay en la nube, para mostrarlo en Configuración. */
export async function listCloud(): Promise<{ files: { name: string; size: number; at: string }[]; photos: number; photosSize: number; totalSize: number } | { error: string }> {
  const c = await getCloudConfig();
  if (!isReady(c)) return { error: "Sin configurar" };
  try {
    const s3 = client(c);
    const [db, photos] = await Promise.all([listAll(s3, c.bucket, "respaldos/"), listAll(s3, c.bucket, "fotos/")]);
    const files = db.filter((o) => o.Key && /db_.*\.dump$/.test(o.Key))
      .map((o) => ({ name: o.Key!.replace(/^respaldos\//, ""), size: o.Size || 0, at: (o.LastModified || new Date(0)).toISOString() }))
      .sort((a, b) => b.at.localeCompare(a.at));
    const photosSize = photos.reduce((a, o) => a + (o.Size || 0), 0);
    return { files, photos: photos.length, photosSize, totalSize: photosSize + files.reduce((a, f) => a + f.size, 0) };
  } catch (e) {
    return { error: explain(e) };
  }
}

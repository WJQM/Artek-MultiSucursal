// IMEI de celulares.
// - Gratis: validación del IMEI (dígito de control, algoritmo de Luhn) e historial en el taller ("este celular ya vino antes").
// - Opcional y pagado: consulta en imeicheck.net (u otro servicio compatible) → modelo, reporte de robo/pérdida (lista negra),
//   bloqueo de operador, iCloud/Find My. La clave se guarda en KeyValue "imei:config" y nunca se envía al navegador.
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";

export interface ImeiConfig { apiKey: string; url: string; serviceId: string }
export interface ImeiCheck {
  at: string;
  service?: string;
  model?: string;
  /** "clean" (limpio) | "blacklisted" (reportado) | "unknown" */
  blacklist: "clean" | "blacklisted" | "unknown";
  /** "locked" | "unlocked" | "unknown" */
  simLock: "locked" | "unlocked" | "unknown";
  /** Find My / iCloud: "on" | "off" | "unknown" */
  findMy: "on" | "off" | "unknown";
  carrier?: string;
  /** Todos los datos que devolvió el servicio (para ver el detalle) */
  details: [string, string][];
  cost?: number;
}

const KEY = "imei:config";
const DEFAULT_URL = "https://api.imeicheck.net/v1/checks";
const cacheKey = (imei: string) => `imei:last:${imei}`;

export const cleanImei = (s: unknown) => (typeof s === "string" ? s.replace(/[\s.-]/g, "").toUpperCase().slice(0, 30) : "");

/** IMEI de 15 dígitos con dígito de control correcto. */
export function luhnValid(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
/** 15 dígitos = IMEI (se valida); otro formato (6–30 letras/números) = número de serie. */
export function imeiKind(s: string): "imei" | "imei-bad" | "serial" | "invalid" {
  if (/^\d{15}$/.test(s)) return luhnValid(s) ? "imei" : "imei-bad";
  if (/^\d{14,17}$/.test(s)) return "imei-bad";
  if (/^[A-Z0-9]{6,30}$/.test(s)) return "serial";
  return "invalid";
}

export async function getImeiConfig(): Promise<ImeiConfig> {
  return { apiKey: "", url: DEFAULT_URL, serviceId: "", ...(await readKV<Partial<ImeiConfig>>(KEY, {})) };
}
export async function imeiReady() {
  const c = await getImeiConfig();
  return !!(c.apiKey && c.url && c.serviceId);
}
export async function publicImeiConfig() {
  const c = await getImeiConfig();
  return { url: c.url, serviceId: c.serviceId, hasKey: !!c.apiKey, ready: !!(c.apiKey && c.url && c.serviceId) };
}
export async function saveImeiConfig(input: Record<string, unknown>) {
  const cur = await getImeiConfig();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const next: ImeiConfig = {
    apiKey: input.removeKey === true ? "" : str(input.apiKey, 300) || cur.apiKey,
    url: str(input.url, 300) || cur.url || DEFAULT_URL,
    serviceId: str(input.serviceId, 40) ?? cur.serviceId,
  };
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?\/\S*$/i.test(next.url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(next.url)) throw new Error("La dirección del servicio debe empezar con https://");
  if (next.serviceId && !/^[A-Za-z0-9_-]{1,40}$/.test(next.serviceId)) throw new Error("El número de servicio solo lleva números o letras");
  await writeKV(KEY, next);
  return publicImeiConfig();
}

// ---------- historial gratis ----------
export async function imeiHistory(imei: string, exceptId?: string) {
  if (!imei) return [];
  const rows = await prisma.repair.findMany({
    where: { imei, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, code: true, device: true, brand: true, model: true, issue: true, status: true, createdAt: true, branchId: true, clientName: true, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows;
}

// ---------- consulta pagada ----------
const flat = (o: unknown, prefix = "", out: [string, string][] = []): [string, string][] => {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) flat(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (o !== null && o !== undefined && o !== "" && !Array.isArray(o)) {
    out.push([prefix, String(o).replace(/<[^>]+>/g, " ").trim().slice(0, 200)]);
  }
  return out;
};
const yes = (v: string) => /^(true|yes|si|sí|on|1|blacklisted|blocked|reported|lost|stolen|locked|enabled)\b/i.test(v.trim()) || /\b(blacklisted|reported|stolen|lost|blocked)\b/i.test(v);
const no = (v: string) => /^(false|no|off|0|clean|unlocked|disabled|not\b)/i.test(v.trim()) || /\b(clean|unlocked|not (blacklisted|reported|locked))\b/i.test(v);

/** Lee cualquier respuesta (los servicios cambian los nombres de los campos) y saca lo importante. */
export function parseImeiResponse(d: Record<string, unknown>): ImeiCheck {
  const props = (d.properties && typeof d.properties === "object" ? d.properties : d.result && typeof d.result === "object" ? d.result : d) as Record<string, unknown>;
  const details = flat(props).filter(([k]) => !/image|imageurl|^id$|deviceid|orderid/i.test(k)).slice(0, 30);
  const find = (re: RegExp) => details.find(([k]) => re.test(k))?.[1];
  const tri = <A extends string, B extends string>(v: string | undefined, a: A, b: B): A | B | "unknown" => (v === undefined ? "unknown" : no(v) ? b : yes(v) ? a : "unknown");
  const bl = find(/blacklist|blocklist|gsma|lost|stolen/i);
  const lock = find(/sim.?lock|simlock|carrier.?lock|network.?lock|locked/i);
  const fmi = find(/fmi|find.?my|icloud/i);
  const service = (d.service as { title?: string } | undefined)?.title;
  return {
    at: new Date().toISOString(),
    service,
    model: find(/^(devicename|modeldesc|model|modelname|device)$/i) || find(/model|devicename/i),
    blacklist: tri(bl, "blacklisted", "clean"),
    simLock: tri(lock, "locked", "unlocked"),
    findMy: tri(fmi, "on", "off"),
    carrier: find(/carrier|operator|network|lockedcarrier/i),
    details,
    cost: typeof d.amount === "number" ? d.amount : typeof d.amount === "string" && !isNaN(+d.amount) ? +d.amount : undefined,
  };
}

/** Consulta pagada. Guarda el resultado 2 horas (por IMEI) para usarlo al crear la orden sin volver a pagar. */
export async function checkImei(imei: string): Promise<{ ok: true; check: ImeiCheck } | { ok: false; error: string }> {
  const c = await getImeiConfig();
  if (!c.apiKey || !c.serviceId) return { ok: false, error: "La consulta de IMEI no está configurada" };
  const cached = await readKV<ImeiCheck | null>(cacheKey(imei), null);
  if (cached && Date.now() - new Date(cached.at).getTime() < 2 * 3600_000) return { ok: true, check: cached };
  try {
    const r = await fetch(c.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify({ deviceId: imei, serviceId: /^\d+$/.test(c.serviceId) ? Number(c.serviceId) : c.serviceId }),
      signal: AbortSignal.timeout(60_000),
    });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.status === 401 || r.status === 403) return { ok: false, error: "La clave del servicio de IMEI no es válida" };
    if (r.status === 402 || /balance|insufficient|funds/i.test(String(d.message || d.error || ""))) return { ok: false, error: "El servicio de IMEI no tiene saldo. Recarga en tu cuenta." };
    if (!r.ok) return { ok: false, error: `El servicio respondió: ${String(d.message || d.error || r.status).slice(0, 150)}` };
    if (typeof d.status === "string" && /fail|reject|error|unsuccess/i.test(d.status)) return { ok: false, error: "El servicio no encontró datos para ese IMEI (verifica el número)" };
    const check = parseImeiResponse(d);
    await writeKV(cacheKey(imei), check);
    return { ok: true, check };
  } catch (e) {
    console.error("[IMEI]", (e as Error)?.message);
    return { ok: false, error: "No se pudo conectar con el servicio de IMEI" };
  }
}

/** Resultado reciente ya pagado (para guardarlo en la orden al crearla). */
export async function recentCheck(imei: string): Promise<ImeiCheck | null> {
  const c = await readKV<ImeiCheck | null>(cacheKey(imei), null);
  return c && Date.now() - new Date(c.at).getTime() < 2 * 3600_000 ? c : null;
}

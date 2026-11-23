// IA para redactar diagnósticos e informes (Claude de Anthropic).
// - El Super Admin pega su clave de API (console.anthropic.com) en Configuración. Nunca se envía al navegador.
// - El técnico escribe sus notas rápidas y pulsa "✨ Redactar con IA": vuelve un texto claro para el cliente.
//   Nada se guarda ni se envía hasta que la persona pulsa "Usar este texto" y luego "Registrar".
// - El precio sugerido NO lo inventa la IA: sale de reparaciones parecidas ya entregadas en la sucursal.
import { prisma } from "./prisma";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";

export const AI_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — rápido y económico (recomendado)", inUsd: 1, outUsd: 5 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — redacción más cuidada", inUsd: 3, outUsd: 15 },
] as const;
export type AiModel = (typeof AI_MODELS)[number]["id"];

export interface AiConfig { enabled: boolean; apiKey: string; model: AiModel }
interface Usage { calls: number; inTok: number; outTok: number; usd: number }

const KEY = "ai:config";
const usageKey = (d = new Date()) => `ai:usage:${d.toISOString().slice(0, 7)}`;
const api = () => (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/+$/, "");

export async function getAiConfig(): Promise<AiConfig> {
  const c = { enabled: false, apiKey: "", model: AI_MODELS[0].id as AiModel, ...(await readKV<Partial<AiConfig>>(KEY, {})) };
  if (!AI_MODELS.some((m) => m.id === c.model)) c.model = AI_MODELS[0].id;
  return c;
}
export async function aiReady(): Promise<boolean> {
  const c = await getAiConfig();
  return c.enabled && !!c.apiKey;
}
export async function publicAiConfig() {
  const c = await getAiConfig();
  const usage = await readKV<Usage>(usageKey(), { calls: 0, inTok: 0, outTok: 0, usd: 0 });
  return { enabled: c.enabled, model: c.model, hasKey: !!c.apiKey, ready: c.enabled && !!c.apiKey, models: AI_MODELS.map(({ id, label }) => ({ id, label })), usage };
}

export async function saveAiConfig(input: Record<string, unknown>) {
  const cur = await getAiConfig();
  const key = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  if (key && !/^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(key)) throw new Error("La clave debe empezar con sk-ant-… (cópiala completa de console.anthropic.com)");
  const next: AiConfig = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : cur.enabled,
    apiKey: input.removeKey === true ? "" : key || cur.apiKey,
    model: AI_MODELS.some((m) => m.id === input.model) ? (input.model as AiModel) : cur.model,
  };
  if (next.enabled && !next.apiKey) next.enabled = false;
  await writeKV(KEY, next);
  return publicAiConfig();
}

function explain(status: number, msg: string): string {
  if (status === 401) return "La clave de IA no es válida. Revísala en Configuración.";
  if (status === 403) return "La clave de IA no tiene permiso para usar este modelo.";
  if (/credit balance/i.test(msg)) return "La cuenta de IA no tiene saldo. Recarga créditos en console.anthropic.com › Billing.";
  if (status === 429) return "Demasiadas consultas a la IA en este momento, prueba en un minuto.";
  if (status === 529 || status >= 500) return "El servicio de IA está ocupado, prueba en un momento.";
  if (status === 0) return "No se pudo conectar con el servicio de IA.";
  return `Error de IA: ${msg.slice(0, 150)}`;
}

async function addUsage(model: AiModel, inTok: number, outTok: number) {
  const m = AI_MODELS.find((x) => x.id === model)!;
  const k = usageKey();
  const u = await readKV<Usage>(k, { calls: 0, inTok: 0, outTok: 0, usd: 0 });
  await writeKV(k, { calls: u.calls + 1, inTok: u.inTok + inTok, outTok: u.outTok + outTok, usd: +(u.usd + (inTok * m.inUsd + outTok * m.outUsd) / 1e6).toFixed(4) });
}

/** Llama a la API de mensajes. Nunca lanza error. */
async function ask(system: string, user: string, maxTokens = 600, cfg?: AiConfig): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const c = cfg || (await getAiConfig());
  if (!c.apiKey) return { ok: false, error: "La IA no está configurada" };
  try {
    const r = await fetch(`${api()}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(45_000),
    });
    const d = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
    if (!r.ok) return { ok: false, error: explain(r.status, d.error?.message || "") };
    await addUsage(c.model, d.usage?.input_tokens || 0, d.usage?.output_tokens || 0);
    const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
    return text ? { ok: true, text } : { ok: false, error: "La IA no devolvió texto, prueba de nuevo." };
  } catch (e) {
    console.error("[IA]", (e as Error)?.message);
    return { ok: false, error: explain(0, "") };
  }
}

/** Botón "Probar" de Configuración. */
export async function testAi(): Promise<{ ok: boolean; error?: string; sample?: string }> {
  const c = await getAiConfig();
  if (!c.apiKey) return { ok: false, error: "Primero pega y guarda la clave" };
  const r = await ask("Responde en español, en una sola frase corta.", "Saluda a un taller de reparación de celulares y computadoras.", 60, c);
  return r.ok ? { ok: true, sample: r.text } : { ok: false, error: r.error };
}

// ---------- redactar ----------
export type DraftStage = "diagnosed" | "waiting_parts" | "in_progress" | "completed" | "novedad";
const STAGE_GOAL: Record<DraftStage, string> = {
  diagnosed: "el DIAGNÓSTICO: qué se encontró en el equipo y qué se recomienda hacer",
  waiting_parts: "el aviso de REPUESTO NECESARIO: qué pieza falta y por qué, y que se avisará cuando llegue",
  in_progress: "el INICIO DE LA REPARACIÓN: qué trabajo se va a realizar",
  completed: "el INFORME FINAL: qué se hizo, cómo se probó y recomendaciones de cuidado",
  novedad: "una NOVEDAD sobre la reparación",
};

export interface DraftInput {
  stage: DraftStage;
  notes: string;
  short?: boolean;
  previous?: string;
  repair: { device: string; brand: string | null; model: string | null; issue: string; clientName: string | null };
}

export async function draftText(i: DraftInput): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const s = await getSettings();
  const company = s?.companyName || "el taller";
  const system = [
    `Eres el asistente de redacción de ${company}, un taller de reparación de equipos electrónicos en Bolivia.`,
    "Conviertes las notas rápidas del técnico en un texto claro y amable para el CLIENTE, en español neutro boliviano, tratándolo de usted.",
    "Reglas:",
    "- Usa SOLO los hechos de las notas y de los datos del equipo. No inventes fallas, piezas, pruebas, tiempos ni garantías.",
    "- No menciones precios ni montos (el taller los informa aparte), salvo que estén en las notas.",
    "- Explica los términos técnicos con palabras simples cuando ayude.",
    "- Sin saludo largo ni firma, sin emojis, sin markdown, sin comillas. Texto corrido, máximo 2 párrafos cortos.",
    i.short ? "- Esta vez hazlo MUY breve: 1 o 2 oraciones." : "- Entre 2 y 5 oraciones.",
    "- Devuelve únicamente el texto final.",
  ].join("\n");
  const dev = [i.repair.device, i.repair.brand, i.repair.model].filter(Boolean).join(" ");
  const user = [
    `Equipo: ${dev}`,
    `Problema que reportó el cliente: ${i.repair.issue}`,
    `Hay que redactar ${STAGE_GOAL[i.stage]}.`,
    `Notas del técnico: ${i.notes.trim() || "(sin notas; redacta algo general y breve basado solo en el problema reportado, sin afirmar hallazgos)"}`,
    i.previous ? `Versión anterior (hazla más corta, mismos hechos): ${i.previous}` : "",
  ].filter(Boolean).join("\n");
  const r = await ask(system, user.slice(0, 6000), i.short ? 200 : 500);
  if (!r.ok) return r;
  return { ok: true, text: r.text.replace(/^["“]|["”]$/g, "").replace(/\*\*/g, "").slice(0, 2000) };
}

// ---------- precio sugerido (de la historia del taller, no de la IA) ----------
const STOP = new Set("de la el los las un una y o en con sin por para que se no al del su sus muy le lo ya mas más es esta está no".split(" "));
const words = (s: string | null | undefined) => new Set((s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));

export interface PriceHint { min: number; max: number; median: number; count: number; examples: { code: string; label: string; cost: number }[] }

export async function priceHint(repair: { id: string; branchId: string; device: string; brand: string | null; model: string | null; issue: string }, notes = ""): Promise<PriceHint | null> {
  const since = new Date(Date.now() - 540 * 86_400_000);
  const rows = await prisma.repair.findMany({
    where: { branchId: repair.branchId, id: { not: repair.id }, status: "delivered", estimatedCost: { gt: 0 }, createdAt: { gte: since } },
    select: { code: true, device: true, brand: true, model: true, issue: true, estimatedCost: true },
    orderBy: { createdAt: "desc" },
    take: 1500,
  });
  if (!rows.length) return null;
  // Mismo tipo de equipo (palabras del equipo/marca) y misma falla (palabras del problema y de las notas)
  const wantDev = words(`${repair.device} ${repair.brand || ""}`);
  const wantIssue = new Set([...words(repair.issue), ...words(notes)]);
  const model = (repair.model || "").trim().toLowerCase();
  const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
  const scored = rows.map((r) => {
    const dev = overlap(words(`${r.device} ${r.brand || ""}`), wantDev);
    const issue = overlap(words(r.issue), wantIssue);
    return { r, dev, issue, score: issue * 2 + dev + (model && r.model?.trim().toLowerCase() === model ? 2 : 0) };
  }).filter((x) => x.dev > 0 && x.issue > 0).sort((a, b) => b.score - a.score).slice(0, 12);
  if (scored.length < 2) return null;
  const costs = scored.map((x) => x.r.estimatedCost).sort((a, b) => a - b);
  const q = (p: number) => costs[Math.min(costs.length - 1, Math.max(0, Math.round(p * (costs.length - 1))))];
  return {
    // Con pocos casos se muestra el rango completo; con más, sin los extremos
    min: Math.round(costs.length < 5 ? costs[0] : q(0.2)), max: Math.round(costs.length < 5 ? costs[costs.length - 1] : q(0.8)), median: Math.round(q(0.5)), count: scored.length,
    examples: scored.slice(0, 3).map((x) => ({ code: x.r.code, label: `${x.r.device} · ${x.r.issue.slice(0, 60)}`, cost: x.r.estimatedCost })),
  };
}

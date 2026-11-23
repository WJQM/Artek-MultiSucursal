// Correo del sistema (SMTP): Gmail, Brevo, Resend u otro.
// Se usa para enviar comprobantes/cotizaciones al cliente, el código de recuperación de contraseña
// y alertas del sistema. La configuración (con la contraseña) se guarda en KeyValue "mail:config";
// la contraseña nunca se devuelve al navegador.
import nodemailer from "nodemailer";
import { readKV, writeKV } from "./automation";
import { getSettings } from "./company";

export type MailProvider = "gmail" | "brevo" | "resend" | "smtp";
export interface MailConfig {
  provider: MailProvider;
  host: string; port: number; secure: boolean;
  user: string; pass: string;
  /** Correo que aparece como remitente (en Gmail, el mismo usuario) */
  fromEmail: string;
  /** Nombre que ve el cliente */
  fromName: string;
  /** Adónde llegan las alertas del sistema (respaldo fallido, etc.) */
  alertEmail: string;
}
export interface MailStatus { at: string; ok: boolean; to?: string; error?: string }

const KEY = "mail:config";
const STATUS_KEY = "mail:last";
const PRESETS: Record<Exclude<MailProvider, "smtp">, { host: string; port: number; secure: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  brevo: { host: "smtp-relay.brevo.com", port: 587, secure: false },
  resend: { host: "smtp.resend.com", port: 465, secure: true },
};
const DEFAULT: MailConfig = { provider: "gmail", host: PRESETS.gmail.host, port: 465, secure: true, user: "", pass: "", fromEmail: "", fromName: "", alertEmail: "" };

export const isEmail = (s: unknown): s is string => typeof s === "string" && s.length <= 254 && /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(s.trim());

export async function getMailConfig(): Promise<MailConfig> {
  return { ...DEFAULT, ...(await readKV<Partial<MailConfig>>(KEY, {})) };
}
export async function mailReady(): Promise<boolean> {
  const c = await getMailConfig();
  return !!(c.host && c.user && c.pass && (c.fromEmail || isEmail(c.user)));
}
export async function publicMailConfig() {
  const c = await getMailConfig();
  const { pass, ...rest } = c;
  return { ...rest, hasPass: !!pass, ready: await mailReady() };
}

export async function saveMailConfig(input: Record<string, unknown>) {
  const cur = await getMailConfig();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const provider = (["gmail", "brevo", "resend", "smtp"] as const).includes(input.provider as MailProvider) ? (input.provider as MailProvider) : cur.provider;
  const preset = provider === "smtp" ? null : PRESETS[provider];
  const port = Number(input.port);
  const next: MailConfig = {
    provider,
    host: preset ? preset.host : (str(input.host, 200) ?? cur.host),
    port: preset ? preset.port : (Number.isInteger(port) && port > 0 && port < 65536 ? port : cur.port),
    secure: preset ? preset.secure : (typeof input.secure === "boolean" ? input.secure : cur.secure),
    user: str(input.user, 200) ?? cur.user,
    // Gmail muestra la contraseña de aplicación con espacios: se quitan. Vacío = no cambiar.
    pass: (str(input.pass, 300) || "").replace(provider === "gmail" ? /\s+/g : /$^/, "") || cur.pass,
    fromEmail: str(input.fromEmail, 254) ?? cur.fromEmail,
    fromName: (str(input.fromName, 80) ?? cur.fromName).replace(/["<>\r\n]/g, ""),
    alertEmail: str(input.alertEmail, 254) ?? cur.alertEmail,
  };
  if (provider === "gmail" || provider === "resend") next.fromEmail = provider === "gmail" ? next.user : next.fromEmail;
  if (next.fromEmail && !isEmail(next.fromEmail)) throw new Error("El correo que envía no es válido");
  if (provider === "gmail" && next.user && !isEmail(next.user)) throw new Error("Escribe el Gmail completo, ej: taller@gmail.com");
  if (next.alertEmail && !isEmail(next.alertEmail)) throw new Error("El correo para alertas no es válido");
  if (provider === "smtp" && next.host && !/^[a-z0-9.-]+$/i.test(next.host)) throw new Error("Servidor SMTP inválido");
  await writeKV(KEY, next);
  return publicMailConfig();
}

function explain(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const m = err?.message || String(e);
  if (err?.code === "EAUTH" || err?.responseCode === 535) return "Usuario o contraseña incorrectos. En Gmail usa una contraseña de aplicación (no tu contraseña normal).";
  if (err?.code === "ESOCKET" || err?.code === "ECONNECTION" || err?.code === "ETIMEDOUT" || /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(m)) return "No se pudo conectar con el servidor de correo. Revisa el servicio elegido o la conexión del servidor.";
  if (err?.responseCode === 550 || err?.responseCode === 553) return "El servidor rechazó el remitente o el destinatario. Revisa los correos.";
  return m.slice(0, 200);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Plantilla con la marca del taller (tablas en línea: así se ve bien en Gmail y Outlook). */
export async function mailLayout(opts: { title: string; intro: string; rows?: [string, string][]; button?: { text: string; url: string }; footerNote?: string }) {
  const s = await getSettings();
  const company = s?.companyName || "RepairTrackQR";
  const sub = [s?.slogan, s?.city].filter(Boolean).join(" · ");
  const rows = (opts.rows || []).map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#1e2a3a">${escapeHtml(v)}</td></tr>`).join("");
  const btn = opts.button ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 6px"><tr><td align="center" style="background:#16a34a;border-radius:10px"><a href="${escapeHtml(opts.button.url)}" style="display:block;padding:14px 18px;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px">${escapeHtml(opts.button.text)}</a></td></tr></table>
<p style="text-align:center;font-size:12px;color:#888;margin:0;word-break:break-all">o copia este enlace: ${escapeHtml(opts.button.url)}</p>` : "";
  const contact = [s?.address, s?.phone, s?.email].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#1e2a3a;padding:18px 22px;color:#ffffff"><div style="font-size:18px;font-weight:800">${escapeHtml(company)}</div>${sub ? `<div style="font-size:12px;opacity:.75;margin-top:2px">${escapeHtml(sub)}</div>` : ""}</td></tr>
<tr><td style="padding:22px;font-size:14px;line-height:1.6;color:#333">
<div style="font-size:17px;font-weight:800;color:#1e2a3a;margin-bottom:8px">${escapeHtml(opts.title)}</div>
<div>${opts.intro}</div>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;font-size:14px">${rows}</table>` : ""}
${btn}
</td></tr>
<tr><td style="padding:14px 22px;border-top:1px solid #f0f0f0;font-size:11.5px;color:#888;line-height:1.5">${escapeHtml(company)}${contact ? ` · ${contact}` : ""}${opts.footerNote ? `<br>${escapeHtml(opts.footerNote)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  return html;
}
export { escapeHtml };

/** Envía un correo. Devuelve { ok, error } y nunca lanza error. */
export async function sendMail(to: string, subject: string, html: string, text?: string): Promise<{ ok: boolean; error?: string }> {
  const c = await getMailConfig();
  if (!(await mailReady())) return { ok: false, error: "El correo del sistema no está configurado (Configuración › Tareas automáticas › Correo)" };
  if (!isEmail(to)) return { ok: false, error: "Correo del destinatario inválido" };
  const s = await getSettings();
  const fromName = c.fromName || s?.companyName || "RepairTrackQR";
  const fromEmail = c.fromEmail || c.user;
  try {
    const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 });
    await t.sendMail({
      from: { name: fromName, address: fromEmail },
      to: to.trim(),
      replyTo: s?.email && isEmail(s.email) ? s.email : undefined,
      subject: subject.replace(/[\r\n]/g, " ").slice(0, 200),
      html,
      text: text || html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    await writeKV(STATUS_KEY, { at: new Date().toISOString(), ok: true, to: to.trim() } satisfies MailStatus);
    return { ok: true };
  } catch (e) {
    const error = explain(e);
    console.error("[Correo]", (e as Error)?.message || e);
    await writeKV(STATUS_KEY, { at: new Date().toISOString(), ok: false, to: to.trim(), error } satisfies MailStatus);
    return { ok: false, error };
  }
}

export async function mailStatus(): Promise<MailStatus | null> {
  return readKV<MailStatus | null>(STATUS_KEY, null);
}

/** Alerta del sistema al correo configurado para alertas (si hay). Nunca lanza error. */
export async function sendAlertMail(title: string, message: string) {
  try {
    const c = await getMailConfig();
    if (!c.alertEmail || !(await mailReady())) return;
    const html = await mailLayout({ title, intro: escapeHtml(message).replace(/\n/g, "<br>"), footerNote: "Alerta automática del sistema." });
    await sendMail(c.alertEmail, `⚠️ ${title}`, html);
  } catch { /* nunca bloquea */ }
}

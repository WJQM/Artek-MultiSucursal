"use client";
import { Banknote, Clock, FileText, Inbox, Joystick, Laptop, MessageCircle, Package, Settings } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Apartados que los clientes hicieron desde el portal: vender, dar más tiempo o cancelar.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";
import { sileo } from "@/frontend/lib/toast";
import { FormModal } from "@/frontend/components/FormKit";
import { waLink } from "@/frontend/components/ReceiptShare";
import { askConfirm } from "@/frontend/lib/dialog";

type Status = "active" | "sold" | "expired" | "cancelled";
interface Resv {
  id: string; code: string; kind: "inventory" | "equipment" | "console"; itemName: string; qty: number; price: number; total: number;
  clientName: string; clientPhone: string; status: Status; expiresAt: string; until: string; createdAt: string; endedAt: string | null;
  extended: number; saleId: string | null; saleCode: string | null; cancelledBy: string | null; branch: string; waiting: number; stockShort: boolean;
}
interface Cfg { enabled: boolean; hours: number; hoursOptions: number[]; maxPerPhone: number; maxQty: number }

const TABS: { key: Status; label: string }[] = [
  { key: "active", label: "Activos" }, { key: "sold", label: "Vendidos" }, { key: "expired", label: "Vencidos" }, { key: "cancelled", label: "Cancelados" },
];
const KIND_ICON = { inventory: Package, equipment: Laptop, console: Joystick } as const;
function KindIcon({ kind }: { kind: keyof typeof KIND_ICON }) { const I = KIND_ICON[kind] || Package; return <I size={14} strokeWidth={STROKE} aria-hidden="true" />; }
const money = (n: number) => `Bs. ${Math.round(n).toLocaleString("es-BO")}`;

function leftLabel(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { text: "vencido", tone: "#b91c1c" };
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
  return { text: h ? `${h} h ${m} min` : `${m} min`, tone: ms < 2 * 3600_000 ? "#b91c1c" : ms < 8 * 3600_000 ? "#b45309" : "#047857" };
}
const fmtDate = (iso: string) => new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export default function ApartadosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [tab, setTab] = useState<Status>("active");
  const [items, setItems] = useState<Resv[] | null>(null);
  const [counts, setCounts] = useState<Record<Status, number>>({ active: 0, sold: 0, expired: 0, cancelled: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [showCfg, setShowCfg] = useState(false);
  const [selling, setSelling] = useState<Resv | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const raw = sessionStorage.getItem("user");
    const u = (() => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } })();
    if (!u) { router.push("/"); return; }
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(() => {
    apiFetch(`/api/reservations?status=${tab}`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo cargar"); setItems([]); return; }
      setError(""); setItems(d.items); setCounts(d.counts);
    }).catch(() => setError("Sin conexión"));
  }, [tab]);
  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { if (user) apiFetch("/api/reservations/config").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCfg(d)).catch(() => {}); }, [user]);
  useLiveRefresh(["Reservation"], () => load());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const act = async (r: Resv, action: "extend" | "cancel", extra: Record<string, unknown> = {}) => {
    if (action === "cancel" && !await askConfirm(`¿Cancelar el apartado ${r.code} de ${r.clientName}? Se le avisará por WhatsApp y el producto vuelve a la venta.`)) return;
    setBusy(r.id);
    try {
      const res = await apiFetch("/api/reservations", { method: "PATCH", body: JSON.stringify({ id: r.id, action, ...extra }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { sileo.error({ title: d.error || "No se pudo" }); return; }
      if (action === "extend") sileo.success({ title: "Le diste más tiempo", description: `Vence el ${d.until}${d.whatsapp === false ? " · no se pudo avisar por WhatsApp" : ""}` });
      else sileo.success({ title: "Apartado cancelado", description: "El producto volvió a la venta" });
      load();
    } finally { setBusy(null); }
  };

  if (!user) return null;
  const isAdminUser = user.role === "admin" || user.role === "superadmin";
  const soon = (items || []).filter((r) => r.status === "active" && new Date(r.expiresAt).getTime() - now < 2 * 3600_000).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        @media(max-width:600px){ .main-content{padding:64px 14px 40px!important} }
      `}</style>
      <AppSidebar user={user} />
      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Apartados</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Productos que los clientes apartaron desde el portal. El stock real se descuenta recién al <b>convertir en venta</b>.</p>
            </div>
            {isAdminUser && <button onClick={() => setShowCfg((v) => !v)} style={btnG}><Settings size={14} strokeWidth={STROKE} aria-hidden="true" /> Configurar</button>}
          </div>

          {cfg && !cfg.enabled && !showCfg && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--warn-bg)", border: "1px solid var(--warn-line)", color: "#78350f", fontSize: 13, marginBottom: 14 }}>
              Los apartados desde el portal están <b>apagados</b> en esta sucursal. <button onClick={() => setShowCfg(true)} style={{ border: "none", background: "none", color: "var(--warn)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: "10px 8px", margin: "-10px -8px", fontFamily: "inherit" }}>Encenderlos</button>
            </div>
          )}
          {showCfg && cfg && <CfgEditor cfg={cfg} onSaved={(c) => { setCfg(c); setShowCfg(false); }} />}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${tab === t.key ? "var(--text-primary)" : "var(--border-strong)"}`, background: tab === t.key ? "var(--text-primary)" : "#fff", color: tab === t.key ? "#fff" : "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {t.label} <span style={{ opacity: 0.75 }}>{counts[t.key] || 0}</span>
              </button>
            ))}
            {tab === "active" && soon > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--danger)", marginLeft: 4 }}><Clock size={14} strokeWidth={STROKE} aria-hidden="true" /> {soon} vence{soon === 1 ? "" : "n"} en menos de 2 h</span>}
          </div>

          {error && <div style={{ padding: 14, borderRadius: 12, background: "var(--danger-bg)", border: "1px solid var(--danger-line)", color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          {!items && !error && <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />}
          {items && !items.length && !error && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "#fff", borderRadius: 14, border: "1px solid var(--border)" }}><Inbox size={14} strokeWidth={STROKE} aria-hidden="true" /> {tab === "active" ? "No hay apartados activos." : "Nada por aquí."}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(items || []).map((r) => {
              const left = leftLabel(r.expiresAt, now);
              const wa = waLink(r.clientPhone, `Hola ${r.clientName.split(" ")[0]}, te escribimos por tu apartado ${r.code} (${r.itemName}).`);
              return (
                <div key={r.id} className="ap-row" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700 }}><KindIcon kind={r.kind} /> {r.itemName}{r.qty > 1 ? ` × ${r.qty}` : ""} <span style={{ color: "var(--accent)" }}>· {money(r.total)}</span></div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>{r.clientName} · {wa ? <a href={wa} target="_blank" rel="noreferrer" style={{ color: "var(--ok)", fontWeight: 700 }}><MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.clientPhone.replace(/^591/, "")}</a> : r.clientPhone}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                        <b>{r.code}</b> · {r.branch} · apartado el {fmtDate(r.createdAt)}{r.extended ? ` · +tiempo ${r.extended}×` : ""}{r.waiting ? ` · ${r.waiting} en espera` : ""}
                        {r.status === "sold" && r.saleCode ? ` · vendido: ${r.saleCode}` : ""}{r.status === "cancelled" ? ` · lo canceló ${r.cancelledBy === "client" ? "el cliente" : r.cancelledBy === "system" ? "el sistema" : "la tienda"}` : ""}
                      </div>
                      {r.stockShort && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>Ya no hay stock suficiente (se vendió en tienda). Cancela el apartado o ajusta el inventario.</div>}
                    </div>
                    {r.status === "active" ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Vence en</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: left.tone }}>{left.text}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.until}</div>
                      </div>
                    ) : (
                      <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: r.status === "sold" ? "var(--ok-bg)" : r.status === "expired" ? "var(--bg-hover)" : "var(--danger-bg)", color: r.status === "sold" ? "var(--ok)" : r.status === "expired" ? "var(--text-muted)" : "var(--danger)" }}>
                        {r.status === "sold" ? "Vendido" : r.status === "expired" ? "Venció" : "Cancelado"}{r.endedAt ? ` · ${fmtDate(r.endedAt)}` : ""}
                      </span>
                    )}
                  </div>
                  {r.status === "active" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                      <button disabled={busy === r.id} onClick={() => setSelling(r)} style={{ ...btnP, flex: "2 1 190px", background: "var(--ok)" }}><Banknote size={14} strokeWidth={STROKE} aria-hidden="true" /> Convertir en venta</button>
                      <button disabled={busy === r.id} onClick={() => act(r, "extend", { hours: 24 })} style={{ ...btnG, flex: "1 1 90px" }}>+24 h</button>
                      <button disabled={busy === r.id} onClick={() => act(r, "cancel")} style={{ ...btnG, flex: "1 1 90px", color: "var(--danger)", borderColor: "var(--danger-line)" }}>Cancelar</button>
                    </div>
                  )}
                  {r.status === "sold" && r.saleCode && (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => router.push("/quotations")} style={{ ...btnG, fontSize: 12 }}><FileText size={14} strokeWidth={STROKE} aria-hidden="true" /> Ver nota de venta {r.saleCode}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selling && <SellModal r={selling} onClose={() => setSelling(null)} onDone={(code) => { setSelling(null); sileo.success({ title: `Venta ${code} creada`, description: "Se descontó del stock" }); load(); }} />}
    </div>
  );
}

function SellModal({ r, onClose, onDone }: { r: Resv; onClose: () => void; onDone: (code: string) => void }) {
  const [pay, setPay] = useState<"cash" | "qr">("cash");
  const [busy, setBusy] = useState(false);
  const sell = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/reservations", { method: "PATCH", body: JSON.stringify({ id: r.id, action: "sell", paidWith: pay }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { sileo.error({ title: d.error || "No se pudo vender" }); return; }
      onDone(d.saleCode);
    } finally { setBusy(false); }
  };
  return (
    <FormModal icon={<Banknote size={24} strokeWidth={STROKE} aria-hidden="true" />} onClose={onClose} title={`Vender apartado ${r.code}`} subtitle={`${r.clientName} recoge y paga`}
      footer={<>
        <button type="button" className="ox-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className={`ox-go${busy ? " is-busy" : ""}`} disabled={busy} onClick={sell}><span className="lbl">{busy ? "Vendiendo…" : `Crear nota de venta · ${money(r.total)}`}</span>{busy && <i className="rt-spin" aria-hidden="true" />}</button>
      </>}>
      <div style={{ padding: "4px 2px" }}>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.6 }}>
          <KindIcon kind={r.kind} /> <b>{r.itemName}</b>{r.qty > 1 ? ` × ${r.qty}` : ""} — <b>{money(r.total)}</b><br />
          <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>Se crea la nota de venta con los datos del cliente y se descuenta del stock.</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: 0.4, margin: "16px 0 8px" }}>¿Cómo pagó?</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([["cash", "Efectivo"], ["qr", "QR"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPay(k)} aria-pressed={pay === k} style={{ flex: 1, padding: 12, borderRadius: 12, border: `2px solid ${pay === k ? "var(--accent)" : "#dbe2ec"}`, background: pay === k ? "var(--accent-bg-soft)" : "#fff", color: pay === k ? "var(--accent-dim)" : "var(--text-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
      </div>
    </FormModal>
  );
}

function CfgEditor({ cfg, onSaved }: { cfg: Cfg; onSaved: (c: Cfg) => void }) {
  const [c, setC] = useState(cfg);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/reservations/config", { method: "PUT", body: JSON.stringify({ enabled: c.enabled, hours: c.hours }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo guardar" }); return; }
      sileo.success({ title: d.enabled ? "Apartados encendidos en esta sucursal" : "Apartados apagados en esta sucursal" });
      onSaved(d);
    } finally { setBusy(false); }
  };
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dim)", letterSpacing: 0.5, marginBottom: 10 }}><Settings size={14} strokeWidth={STROKE} aria-hidden="true" /> Apartados de esta sucursal</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 700, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} /> Permitir que los clientes aparten desde el portal
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", maxWidth: 220 }}>
        Se guarda por
        <select value={c.hours} onChange={(e) => setC({ ...c, hours: Number(e.target.value) })} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "var(--text-primary)" }}>
          {c.hoursOptions.map((h) => <option key={h} value={h}>{h} horas{h === 24 ? " (recomendado)" : ""}</option>)}
        </select>
      </label>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 12px", lineHeight: 1.5 }}>Cada cliente puede tener hasta {c.maxPerPhone} apartados activos y apartar hasta {c.maxQty} unidades de un producto. Aplica a Productos, Repuestos, Equipos y Consolas visibles en el portal.</p>
      <button disabled={busy} onClick={save} style={btnP}>{busy ? "Guardando…" : "Guardar"}</button>
    </div>
  );
}

const btnP: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const btnG: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };

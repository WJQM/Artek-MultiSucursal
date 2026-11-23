"use client";
import { Laptop, MessageCircle, Star, Store, Wrench } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { useLiveRefresh } from "@/frontend/lib/live";

interface Review {
  id: string; repairCode: string; rating: number; comment: string | null;
  clientName: string | null; clientPhone: string | null; createdAt: string;
  device: string | null; technician: string | null; branchId: string; branchName: string | null;
}
interface Summary { count: number; average: number; distribution: number[]; withComment: number }

const PERIODS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "3 meses" },
  { days: 365, label: "1 año" },
  { days: 0, label: "Todo" },
];
const STAR_COLOR = "#f59e0b";
const RATING_COLOR = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#10b981"];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} de 5 estrellas`} style={{ fontSize: size, letterSpacing: 1, whiteSpace: "nowrap" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(value) ? STAR_COLOR : "#d6dbe6" }}>★</span>
      ))}
    </span>
  );
}

function waLink(phone: string | null) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 8) d = "591" + d;
  return d.length >= 10 ? `https://wa.me/${d}` : null;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [days, setDays] = useState(90);
  const [rating, setRating] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyComments, setOnlyComments] = useState(false);
  // Se muestran de 10 en 10 ("Ver 10 más"); vuelve a 10 al cambiar período o filtros
  const PAGE = 10;
  const [shown, setShown] = useState(PAGE);
  const filterKey = `${days}|${rating}|${onlyComments}`;
  const [shownKey, setShownKey] = useState(filterKey);
  if (shownKey !== filterKey) { setShownKey(filterKey); setShown(PAGE); }

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (!u) { router.push("/"); return; }
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- muestra la carga al cambiar el filtro
    apiFetch(`/api/reviews/list?days=${days}${rating ? `&rating=${rating}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancel && d) { setSummary(d.summary); setReviews(d.reviews || []); } })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [user, days, rating]);
  // Se actualiza sola cuando llega una reseña nueva
  useLiveRefresh(["Review"], () => apiFetch(`/api/reviews/list?days=${days}${rating ? `&rating=${rating}` : ""}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { setSummary(d.summary); setReviews(d.reviews || []); } })
    .catch(() => {}), { enabled: !!user });

  if (!user) return null;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
  const list = onlyComments ? reviews.filter((r) => r.comment && r.comment.trim()) : reviews;
  const maxDist = Math.max(1, ...(summary?.distribution || [0]));
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    border: `1.5px solid ${active ? "var(--accent)" : "#cbd5e1"}`, background: active ? "rgba(var(--accent-bright-rgb), 0.10)" : "#fff", color: active ? "var(--accent-dim)" : "var(--text-secondary)",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
        .rv-top { display:grid; grid-template-columns: 240px 1fr; gap: 16px; }
        @media(max-width:700px){ .rv-top { grid-template-columns: 1fr; } }
        @media (hover: hover) and (pointer: fine) { .rv-bar:hover { background: #f5f7fc; } }
      `}</style>

      <AppSidebar user={user} />

      <div className="main-content" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}>Reseñas de clientes</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Los clientes califican desde la página de seguimiento cuando su equipo fue entregado.
              {user.role === "superadmin" ? " Se muestran las de la sucursal activa." : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {PERIODS.map((p) => (
              <button key={p.days} type="button" onClick={() => setDays(p.days)} style={chip(days === p.days)}>{p.label}</button>
            ))}
          </div>

          {/* Resumen */}
          <div className="rv-top" style={{ marginBottom: 18 }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.6 }}>Promedio</div>
              <div style={{ fontSize: 46, fontWeight: 700, color: summary?.count ? STAR_COLOR : "var(--text-muted)", lineHeight: 1.1, marginTop: 6 }}>
                {summary?.count ? summary.average.toFixed(1) : "—"}
              </div>
              <Stars value={summary?.average || 0} size={20} />
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {summary?.count || 0} reseña{summary?.count === 1 ? "" : "s"} · {summary?.withComment || 0} con comentario
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.6, marginBottom: 6 }}>
                Distribución <span style={{ textTransform: "none", fontWeight: 500 }}>· toca una fila para filtrar</span>
              </div>
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary?.distribution[n - 1] || 0;
                const pct = summary?.count ? Math.round((c / summary.count) * 100) : 0;
                const active = rating === n;
                return (
                  <button key={n} type="button" className="rv-bar" onClick={() => setRating(active ? 0 : n)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 8px", borderRadius: 8, border: active ? `1.5px solid ${RATING_COLOR[n - 1]}` : "1.5px solid transparent", background: active ? `${RATING_COLOR[n - 1]}12` : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 34, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "left", flexShrink: 0 }}>{n} ★</span>
                    <span style={{ flex: 1, height: 10, background: "var(--bg-hover)", borderRadius: 99, overflow: "hidden", minWidth: 0 }}>
                      <span style={{ display: "block", height: "100%", width: `${(c / maxDist) * 100}%`, background: RATING_COLOR[n - 1], borderRadius: 99 }} />
                    </span>
                    <span style={{ width: 64, fontSize: 12, color: "var(--text-muted)", textAlign: "right", flexShrink: 0 }}>{c} · {pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros de la lista */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {rating ? `Reseñas de ${rating} ★` : "Todas las reseñas"} <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({list.length})</span>
              {rating > 0 && <button type="button" onClick={() => setRating(0)} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent-dim)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Quitar filtro</button>}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={onlyComments} onChange={(e) => setOnlyComments(e.target.checked)} style={{ width: 16, height: 16 }} />
              Solo con comentario
            </label>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Cargando reseñas…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", background: "#fff", border: "1.5px dashed var(--border-strong)", borderRadius: 14 }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}><Star size={34} strokeWidth={STROKE} aria-hidden="true" /></div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Aún no hay reseñas{days ? " en este período" : ""}</div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 420, marginInline: "auto" }}>
                Cuando una orden pasa a <strong>Entregado</strong>, el cliente ve en su página de seguimiento la opción de calificar el servicio.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.slice(0, shown).map((r) => {
                const wa = waLink(r.clientPhone);
                const low = r.rating <= 2;
                return (
                  <div key={r.id} style={{ background: "#fff", border: `1.5px solid ${low ? "rgba(239,68,68,0.35)" : "var(--border-strong)"}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                        <Stars value={r.rating} size={16} />
                        <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{r.clientName || "Cliente"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</span>
                    </div>
                    {r.comment && r.comment.trim() ? (
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", margin: "8px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>“{r.comment}”</p>
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0", fontStyle: "italic" }}>Sin comentario</p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px 12px", flexWrap: "wrap", marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
                      <a href={`/track/${r.repairCode}?branchId=${r.branchId}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent-dim)", textDecoration: "none", whiteSpace: "nowrap" }}>{r.repairCode} ↗</a>
                      {r.device && <span><Laptop size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.device}</span>}
                      {r.technician && <span><Wrench size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.technician}</span>}
                      {user.role === "superadmin" && !sessionStorage.getItem("activeBranchId") && r.branchName && <span><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.branchName}</span>}
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 8, border: "1.5px solid #25d366", color: "var(--ok)", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                          <MessageCircle size={14} strokeWidth={STROKE} aria-hidden="true" /> {low ? "Contactar al cliente" : "WhatsApp"}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {list.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)}
                  style={{ marginTop: 4, height: 44, borderRadius: 12, border: "1.5px solid var(--border-strong)", background: "#fff", color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Ver {Math.min(PAGE, list.length - shown)} más ↓ <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>· {shown} de {list.length}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

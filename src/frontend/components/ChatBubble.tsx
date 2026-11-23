"use client";
import { Hand, Store, Wrench, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { useLiveRefresh } from "@/frontend/lib/live";
import { useBumpOnIncrease } from "@/frontend/lib/motion";
import { sileo } from "@/frontend/lib/toast";
import { uploadImage } from "@/frontend/lib/upload-image";
import { ImageLightbox } from "./ImageLightbox";
import { pressKey } from "@/frontend/lib/a11y";

/**
 * Chat interno tipo Messenger (personal): burbuja flotante con los no leídos, lista de
 * conversaciones (una por orden + el chat general de la sucursal) y mensajes en tiempo real.
 * Desde cualquier pantalla se abre una conversación con: openChat({ repairId }) u openChat({ branchId }).
 */

const OPEN_EVENT = "rt:open-chat";
export function openChat(target: { repairId?: string; branchId?: string } = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: target }));
}

interface ThreadRow {
  key: string; kind: "repair" | "branch"; repairId: string | null; branchId: string; branchName: string | null;
  title: string; subtitle: string; status: string | null; unread: number;
  last: { text: string; userName: string; mine: boolean; createdAt: string; hasImages: boolean } | null;
}
interface Msg { id: string; text: string; images: string[]; createdAt: string; userName: string; userRole: string; mine: boolean }
interface ThreadInfo { kind: "repair" | "branch"; repairId?: string; branchId: string; code?: string; device?: string; technicianName?: string | null; branchName?: string }

const TEAL = "var(--accent-dim)";
const MAX_IMAGES = 4;
const AVATAR_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#64748b"];
function colorFor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?"; }
const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#b45309" }, diagnosed: { label: "Diagnosticado", color: "#0e7490" },
  waiting_parts: { label: "Esperando repuestos", color: "#c2410c" }, in_progress: { label: "En progreso", color: "#2563eb" },
  completed: { label: "Completado", color: "#047857" }, delivered: { label: "Entregado", color: "#5a6a80" },
};

function Avatar({ name, size = 36, bg }: { name: string; size?: number; bg?: string }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bg || colorFor(name), color: "#fff", fontSize: size * 0.38, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "-0.3px" }}>
      {initials(name)}
    </div>
  );
}
const ICON = {
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  image: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="M21 15l-5-5L5 21" /></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" /></svg>,
  open: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
};

function shortTime(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
}
function dayLabel(iso: string) {
  const d = new Date(iso); const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (d.toDateString() === y.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" });
}

const NO_FAB_PAGES = ["/new-order"];

export function ChatBubble() {
  // true solo en el navegador (el portal necesita document.body)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [open, setOpen] = useState(false);
  // En pantallas de formulario (crear OT) la burbuja tapaba el botón de guardar en el celular: ahí no se muestra.
  // El chat sigue abriéndose desde otros botones (openChat).
  const pathname = usePathname() || "";
  const hideFab = NO_FAB_PAGES.some((p) => pathname.startsWith(p));
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [total, setTotal] = useState(0);
  // Mensaje nuevo: la burbuja da un salto
  const fabRef = useRef<HTMLButtonElement>(null);
  useBumpOnIncrease(total, fabRef, "rt-hop");
  // Celular: la burbuja se esconde mientras bajas la página y vuelve al subir o al quedarte quieto
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    let lastY = window.scrollY;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const show = () => fabRef.current?.classList.remove("rt-fab-away");
    const onScroll = () => {
      const y = window.scrollY;
      const el = fabRef.current;
      if (el && mq.matches) {
        if (y > lastY + 6 && y > 80) el.classList.add("rt-fab-away");
        else if (y < lastY - 6) el.classList.remove("rt-fab-away");
        clearTimeout(idle);
        idle = setTimeout(show, 900);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(idle); };
  }, []);
  const [multiBranch, setMultiBranch] = useState(false);
  const [current, setCurrent] = useState<{ repairId?: string; branchId?: string } | null>(null);
  const [info, setInfo] = useState<ThreadInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [seen, setSeen] = useState<{ name: string; at: string }[]>([]);
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  // Rol del usuario (para "Abrir orden" en la pantalla que corresponde)
  const role = useSyncExternalStore(() => () => {}, () => { try { return JSON.parse(sessionStorage.getItem("user") || "{}").role || ""; } catch { return ""; } }, () => "");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; }, [current]);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const loadList = () => apiFetch("/api/chat", { headers: { "x-branch-id": "" } }).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d) return;
    setThreads(d.threads || []); setTotal(d.totalUnread || 0); setMultiBranch(!!d.multiBranch);
  }).catch(() => {});

  const loadThread = (t: { repairId?: string; branchId?: string }, silent = false) => {
    if (!silent) setLoadingThread(true);
    const q = t.repairId ? `repairId=${encodeURIComponent(t.repairId)}` : `branchId=${encodeURIComponent(t.branchId || "")}`;
    return apiFetch(`/api/chat/thread?${q}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { sileo.error({ title: d.error || "No se pudo abrir el chat" }); setCurrent(null); return; }
      setInfo(d.thread); setMessages(d.messages || []); setSeen(d.seen || []);
      loadList();
    }).catch(() => {}).finally(() => setLoadingThread(false));
  };

  useEffect(() => { loadList(); }, []);
  useLiveRefresh(["Message"], () => {
    loadList();
    if (openRef.current && currentRef.current) loadThread(currentRef.current, true);
  });

  // Respaldo del tiempo real: con el chat abierto y a la vista se revisa cada 4 s (la conversación
  // abierta o la lista). Así los mensajes llegan aunque la conexión en vivo se corte (celular,
  // proxy, datos móviles). Con el chat cerrado, el contador se revisa cada 30 s.
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (openRef.current && currentRef.current) loadThread(currentRef.current, true);
      else if (openRef.current) loadList();
    }, 4_000);
    const slow = setInterval(() => {
      if (document.visibilityState === "visible" && !openRef.current) loadList();
    }, 30_000);
    return () => { clearInterval(iv); clearInterval(slow); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Abrir desde otras pantallas (botón "Chat" de cada orden)
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent).detail || {};
      setOpen(true);
      if (t.repairId || t.branchId) { setCurrent(t); setMessages([]); setInfo(null); loadThread(t); }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Abrir desde un aviso del celular (?chat=r:<orden> o ?chat=b:<sucursal>)
  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("chat");
    if (!key) return;
    url.searchParams.delete("chat");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const [kind, id] = [key.slice(0, 2), key.slice(2)];
    if (!id) return;
    openChat(kind === "r:" ? { repairId: id } : kind === "b:" ? { branchId: id } : {});
  }, []);

  // Bajar al último mensaje
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length, current]);
  // Escape cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !viewer) { if (current) setCurrent(null); else setOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, current, viewer]);

  const openThread = (t: ThreadRow) => {
    const target = t.kind === "repair" ? { repairId: t.repairId! } : { branchId: t.branchId };
    setCurrent(target); setMessages([]); setInfo(null); setSeen([]); setText(""); setImages([]);
    loadThread(target);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try { const url = await uploadImage(f); setImages((p) => [...p, url].slice(0, MAX_IMAGES)); }
      catch (e) { sileo.error({ title: (e as Error).message }); }
      setUploading((n) => n - 1);
    }
  };

  const send = async () => {
    if (!current || sending || uploading) return;
    if (!text.trim() && !images.length) return;
    setSending(true);
    try {
      const res = await apiFetch("/api/chat/thread", { method: "POST", body: JSON.stringify({ ...current, text, images }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) sileo.error({ title: d.error || "No se pudo enviar" });
      else { setText(""); setImages([]); await loadThread(current, true); }
    } catch { sileo.error({ title: "Sin conexión" }); }
    setSending(false);
  };

  if (!mounted) return null;

  const q = query.trim().toLowerCase();
  const shown = threads.filter((t) => (!onlyUnread || t.unread > 0) && (!q || `${t.title} ${t.subtitle} ${t.branchName || ""} ${t.last?.text || ""}`.toLowerCase().includes(q)));
  const unreadThreads = threads.filter((t) => t.unread > 0).length;
  const lastMine = [...messages].reverse().find((m) => m.mine);
  const seenBy = lastMine ? seen.filter((r) => new Date(r.at).getTime() >= new Date(lastMine.createdAt).getTime()).map((r) => r.name.split(" ")[0]) : [];
  const chip = info?.kind === "repair" ? STATUS_CHIP[threads.find((t) => t.repairId === info.repairId)?.status || ""] : undefined;
  const openOrder = () => {
    if (info?.kind !== "repair" || !info.code) return;
    const base = role === "tech" ? "/asignaciones" : "/dashboard";
    setOpen(false);
    window.location.href = `${base}?focus=${encodeURIComponent(info.code)}`;
  };

  return createPortal(
    <>
      <style>{`
        .rt-chat-panel { position: fixed; right: 18px; bottom: calc(88px + env(safe-area-inset-bottom)); width: 400px; height: min(640px, calc(100dvh - 120px)); z-index: 800; background: #fff; border-radius: 20px; box-shadow: 0 24px 70px rgba(15,23,42,0.30), 0 0 0 1px rgba(15,23,42,0.06); display: flex; flex-direction: column; overflow: hidden; animation: rtChatIn .2s cubic-bezier(.2,.8,.2,1); transform-origin: bottom right; }
        @keyframes rtChatIn { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
        @media (max-width: 640px) { .rt-chat-panel { inset: 0; width: auto; height: auto; border-radius: 0; bottom: 0; right: 0; animation: rtChatUp .22s ease-out; } .rt-chat-fab.hide-mobile { display: none !important; } }
        @keyframes rtChatUp { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
        .rt-chat-row { transition: background .12s; }
        @media (hover: hover) and (pointer: fine) { .rt-chat-row:hover { background: #f4f6f9 !important; } }
        .rt-chat-scroll::-webkit-scrollbar { width: 6px; } .rt-chat-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .rt-chat-icon { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.18); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: visible !important; }
        @media (hover: hover) and (pointer: fine) { .rt-chat-icon:hover { background: rgba(255,255,255,0.3); } }
        .rt-bubble-img { display: block; width: 100%; max-height: 240px; object-fit: cover; cursor: zoom-in; }
      `}</style>

      {/* Burbuja flotante */}
      {!hideFab && <button ref={fabRef} type="button" className={`rt-chat-fab${open ? " hide-mobile" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={`Chat interno${total ? `: ${total} sin leer` : ""}`}
        style={{ position: "fixed", right: 18, bottom: "calc(18px + env(safe-area-inset-bottom))", zIndex: 801, width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer", background: `var(--accent-light)`, color: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
        {open ? ICON.close : (
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" fill="rgba(255,255,255,0.18)" /><circle cx="8.5" cy="12" r="1" fill="currentColor" /><circle cx="12.5" cy="12" r="1" fill="currentColor" /><circle cx="16.5" cy="12" r="1" fill="currentColor" /></svg>
        )}
        {!open && total > 0 && <span key={total} className="rt-pop" style={{ position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11, background: "var(--danger-bright)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2.5px solid #fff", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>{total > 99 ? "99+" : total}</span>}
      </button>}

      {open && (
        <div className="rt-chat-panel" role="dialog" aria-label="Chat interno">
          {!current ? (
            <>
              {/* ── Lista de conversaciones ── */}
              <div style={{ padding: "calc(16px + env(safe-area-inset-top)) 16px 12px", background: `var(--accent-light)`, color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px" }}>Mensajes</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>{unreadThreads ? `${unreadThreads} conversación${unreadThreads > 1 ? "es" : ""} sin leer` : "Chat interno del personal"}</div>
                  </div>
                  <button type="button" className="rt-chat-icon" onClick={() => setOpen(false)} aria-label="Cerrar chat">{ICON.close}</button>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: "0 12px", color: "var(--text-muted)" }}>
                  {ICON.search}
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar orden, equipo o mensaje" aria-label="Buscar conversación"
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 0", fontSize: 13.5, color: "var(--text-primary)", minWidth: 0 }} />
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {[{ k: false, l: "Todas" }, { k: true, l: `No leídas${unreadThreads ? ` (${unreadThreads})` : ""}` }].map((f) => (
                    <button key={String(f.k)} type="button" onClick={() => setOnlyUnread(f.k)}
                      style={{ padding: "5px 12px", borderRadius: 99, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: onlyUnread === f.k ? "#fff" : "rgba(255,255,255,0.2)", color: onlyUnread === f.k ? TEAL : "#fff" }}>{f.l}</button>
                  ))}
                </div>
              </div>
              <div className="rt-chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                {threads.length === 0 && [...Array(4)].map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px" }} aria-hidden="true">
                    <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}><div className="skeleton" style={{ height: 13, width: "60%", marginBottom: 8 }} /><div className="skeleton" style={{ height: 11, width: "85%" }} /></div>
                  </div>
                ))}
                {threads.length > 0 && shown.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{onlyUnread ? "No tienes mensajes sin leer" : "Sin resultados"}</div>}
                {shown.map((t) => {
                  const st = t.status ? STATUS_CHIP[t.status] : undefined;
                  return (
                    <button key={t.key} type="button" className="rt-chat-row" onClick={() => openThread(t)}
                      style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "10px 16px", border: "none", background: "#fff", cursor: "pointer", textAlign: "left" }}>
                      {t.kind === "branch" ? (
                        <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: `var(--accent-light)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}><Store size={21} strokeWidth={STROKE} aria-hidden="true" /></div>
                      ) : (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(var(--accent-bright-rgb), 0.1)", border: "1.5px solid rgba(var(--accent-bright-rgb), 0.25)", color: TEAL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{t.title.split("-")[0]}</span>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{t.title.split("-")[1] || ""}</span>
                          </div>
                          {st && <span title={st.label} style={{ position: "absolute", bottom: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: st.color, border: "2.5px solid #fff" }} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: t.unread ? 800 : 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                            {t.kind === "branch" ? `General · ${t.subtitle}` : `${t.title} · ${t.subtitle.split(" · ")[0]}`}
                          </span>
                          {t.last && <span style={{ fontSize: 11, color: t.unread ? TEAL : "var(--text-muted)", fontWeight: t.unread ? 800 : 500, flexShrink: 0 }}>{shortTime(t.last.createdAt)}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 13, color: t.unread ? "var(--text-primary)" : "var(--text-muted)", fontWeight: t.unread ? 650 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                            {t.last ? `${t.last.mine ? "Tú" : t.last.userName.split(" ")[0]}: ${t.last.hasImages && t.last.text === "📷 Foto" ? "Foto" : t.last.text}` : (t.kind === "branch" ? "Todo el personal de la sucursal" : "Sin mensajes todavía")}
                          </span>
                          {t.unread > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: TEAL, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.unread}</span>}
                        </div>
                        {multiBranch && t.kind === "repair" && t.branchName && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {t.branchName}</div>}
                      </div>
                    </button>
                  );
                })}
                <div style={{ margin: "10px 16px 14px", padding: "10px 12px", borderRadius: 12, background: "var(--bg-tertiary)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Para conversar sobre una orden, ábrela y toca <strong style={{ color: TEAL }}>Chat</strong>.
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── Conversación ── */}
              <div style={{ padding: "calc(10px + env(safe-area-inset-top)) 10px 10px", background: `var(--accent-light)`, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="rt-chat-icon" onClick={() => { setCurrent(null); setInfo(null); loadList(); }} aria-label="Volver">{ICON.back}</button>
                {info?.kind === "branch"
                  ? <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}><Store size={19} strokeWidth={STROKE} aria-hidden="true" /></div>
                  : <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{info?.code?.replace(/^[A-Z]+-/, "#") || "…"}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {info ? (info.kind === "repair" ? `${info.code} · ${info.device || ""}` : `General · ${info.branchName}`) : "Cargando…"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, minWidth: 0 }}>
                    {chip && <span style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: "#fff", color: chip.color, whiteSpace: "nowrap" }}>{chip.label}</span>}
                    <span style={{ fontSize: 11.5, opacity: 0.92, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {info?.kind === "repair" ? (info.technicianName ? `Técnico: ${info.technicianName}` : "Sin técnico asignado") : "Todo el personal de la sucursal"}
                    </span>
                  </div>
                </div>
                {info?.kind === "repair" && <button type="button" className="rt-chat-icon" onClick={openOrder} aria-label="Abrir la orden" title="Abrir la orden">{ICON.open}</button>}
                <button type="button" className="rt-chat-icon" onClick={() => setOpen(false)} aria-label="Cerrar chat">{ICON.close}</button>
              </div>

              <div ref={listRef} className="rt-chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 12px 8px", background: "var(--bg-hover)", backgroundImage: "radial-gradient(rgba(20,154,165,0.06) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
                {loadingThread && messages.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12.5, padding: 20 }}>Cargando…</div>}
                {!loadingThread && messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>{info?.kind === "repair" ? <Wrench size={40} strokeWidth={1.5} aria-hidden="true" /> : <Hand size={40} strokeWidth={1.5} aria-hidden="true" />}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{info?.kind === "repair" ? "Conversación de esta orden" : "Chat general"}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{info?.kind === "repair" ? "Lo que escriban aquí queda guardado con la orden." : "Avisos para todo el personal de la sucursal."}</div>
                  </div>
                )}
                {messages.map((m, i) => {
                  const prev = messages[i - 1]; const next = messages[i + 1];
                  const sameDay = (a?: Msg) => !!a && new Date(a.createdAt).toDateString() === new Date(m.createdAt).toDateString();
                  const joins = (a?: Msg) => !!a && sameDay(a) && a.mine === m.mine && a.userName === m.userName && Math.abs(new Date(m.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
                  const first = !joins(prev), last = !joins(next);
                  const onlyPhoto = m.images.length > 0 && m.text === "📷 Foto";
                  const r = 18, s = 5;
                  const radius = m.mine ? `${r}px ${first ? r : s}px ${last ? s : s}px ${r}px` : `${first ? r : s}px ${r}px ${r}px ${last ? s : s}px`;
                  const time = new Date(m.createdAt).toLocaleTimeString("es-BO", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={m.id}>
                      {!sameDay(prev) && <div style={{ textAlign: "center", margin: "10px 0 12px" }}><span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", background: "rgba(255,255,255,0.9)", padding: "4px 12px", borderRadius: 99, boxShadow: "0 1px 2px rgba(15,23,42,0.08)" }}>{dayLabel(m.createdAt)}</span></div>}
                      <div style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6, marginTop: first ? 8 : 2 }}>
                        {!m.mine && (last ? <Avatar name={m.userName} size={28} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
                        <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: m.mine ? "flex-end" : "flex-start" }}>
                          {!m.mine && first && <span style={{ fontSize: 11, fontWeight: 700, color: colorFor(m.userName), margin: "0 10px 3px" }}>{m.userName} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· {m.userRole}</span></span>}
                          <div style={{ borderRadius: radius, overflow: "hidden", background: m.mine ? `linear-gradient(135deg, var(--accent-light), ${TEAL})` : "#fff", color: m.mine ? "#fff" : "var(--text-primary)", boxShadow: "0 1px 2px rgba(15,23,42,0.1)", minWidth: 64 }}>
                            {m.images.length > 0 && (
                              <div style={{ display: "grid", gridTemplateColumns: m.images.length > 1 ? "1fr 1fr" : "1fr", gap: 2, width: m.images.length > 1 ? 240 : 220 }}>
                                {m.images.map((src) => <img loading="lazy" decoding="async" role="button" tabIndex={0} onKeyDown={pressKey} key={src} src={src} alt="Foto" className="rt-bubble-img" onClick={() => setViewer(src)} style={{ aspectRatio: m.images.length > 1 ? "1/1" : undefined }} />)}
                              </div>
                            )}
                            <div style={{ padding: onlyPhoto ? "4px 10px 6px" : "8px 12px 6px", fontSize: 14, lineHeight: 1.42, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {!onlyPhoto && m.text}
                              <span style={{ float: "right", marginLeft: 10, marginTop: onlyPhoto ? 0 : 6, fontSize: 11, opacity: m.mine ? 0.85 : 0.55, lineHeight: 1 }}>{time}</span>
                            </div>
                          </div>
                          {m.mine && lastMine?.id === m.id && (
                            <span style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "3px 6px 0" }}>
                              {seenBy.length ? `✓✓ Visto por ${seenBy.slice(0, 3).join(", ")}${seenBy.length > 3 ? " y más" : ""}` : "✓ Enviado"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Escribir ── */}
              <div style={{ borderTop: "1px solid var(--border-soft)", padding: "8px 10px", paddingBottom: "calc(8px + env(safe-area-inset-bottom))", background: "#fff" }}>
                {(images.length > 0 || uploading > 0) && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {images.map((src) => (
                      <div key={src} style={{ position: "relative" }}>
                        <img src={src} alt="" style={{ width: 58, height: 58, objectFit: "cover", borderRadius: 10 }} />
                        <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== src))} aria-label="Quitar foto" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", background: "var(--danger-bright)", color: "#fff", fontSize: 11, cursor: "pointer", overflow: "visible" }}><X size={12} strokeWidth={STROKE} aria-hidden="true" /></button>
                      </div>
                    ))}
                    {Array.from({ length: uploading }).map((_, i) => <div key={i} style={{ width: 58, height: 58, borderRadius: 10, background: "var(--bg-hover)", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>Subiendo…</div>)}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES} aria-label="Adjuntar foto" title="Adjuntar foto"
                    style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", color: TEAL, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{ICON.image}</button>
                  <textarea aria-label="Mensaje" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Escribe un mensaje…"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); send(); } }}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; }}
                    style={{ flex: 1, resize: "none", minHeight: 40, maxHeight: 120, padding: "10px 14px", borderRadius: 20, border: "none", background: "var(--bg-hover)", fontSize: 14.5, fontFamily: "inherit", outline: "none", lineHeight: 1.35 }} />
                  <button type="button" onClick={send} disabled={sending || uploading > 0 || (!text.trim() && !images.length)} aria-label="Enviar"
                    style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: !text.trim() && !images.length ? "var(--border-soft)" : `linear-gradient(135deg, var(--accent-light), ${TEAL})`, color: !text.trim() && !images.length ? "var(--text-muted)" : "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
                    {ICON.send}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <ImageLightbox src={viewer} onClose={() => setViewer(null)} />
    </>,
    document.body,
  );
}


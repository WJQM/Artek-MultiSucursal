"use client";
import { Columns2, Gamepad2, Laptop, Printer, Tag, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { useEffect, useState } from "react";
import { publicBase } from "@/frontend/lib/public-base";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { Pagination, usePaged } from "@/frontend/components/Pagination";
import { pressKey } from "@/frontend/lib/a11y";

const PAGE_SIZE = 40;

// Solo equipos y consolas: su QR abre la ficha con fotos y especificaciones.
// Productos, programas y videojuegos no llevan QR (no tienen una pantalla propia que abrir).
type Kind = "equipment" | "consoles";

// Fila tal como llega de /api/equipment o /api/consoles
interface CatalogRow { id: string; code?: string; name: string; brand?: string | null; model?: string | null; price?: number | null; image?: string | null }

interface Item {
  id: string;
  code?: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  price?: number;
  image?: string | null;
  kind: Kind;
  qrUrl: string;
  subtitle?: string;
}

const KIND_LABEL: Record<Kind, { label: string; icon: React.ReactNode; color: string; prefix: string }> = {
  equipment: { label: "Equipos", icon: <Laptop size={18} strokeWidth={STROKE} aria-hidden="true" />, color: "#0e7490", prefix: "EQ" },
  consoles: { label: "Consolas", icon: <Gamepad2 size={18} strokeWidth={STROKE} aria-hidden="true" />, color: "#c2410c", prefix: "CN" },
};

// Ficha elegida para imprimir de a dos por hoja (en el orden en que se marcó)
interface FichaSel { kind: Kind; id: string; name: string; code?: string; price?: number }

export default function QrBatchPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [, setActiveBranch] = useState<string>("");
  const [settings, setSettings] = useState<{ companyName: string; logo: string | null }>({ companyName: "", logo: null });

  const [kind, setKind] = useState<Kind>("equipment");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [size, setSize] = useState<"S" | "M" | "L">("M");
  const [showLogo, setShowLogo] = useState(true);
  // Qué se imprime: etiquetas QR o fichas de venta en media hoja (equipos y consolas mezclados)
  const [que, setQue] = useState<"qr" | "fichas">("qr");
  const [fichas, setFichas] = useState<FichaSel[]>([]);
  const [verElegidas, setVerElegidas] = useState(false);
  const cambiarQue = (q: "qr" | "fichas") => { setQue(q); setVerElegidas(false); };
  const fichaElegida = (id: string) => fichas.some(f => f.id === id);
  const alternarFicha = (it: Item) => {
    setFichas(fs => fs.some(f => f.id === it.id) ? fs.filter(f => f.id !== it.id) : [...fs, { kind: it.kind, id: it.id, name: it.name, code: it.code, price: it.price }]);
  };

  useEffect(() => {
    const token = sessionStorage.getItem("token"); const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(userData); } catch { return null; } })(); setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla
    if (u.role === "tech") { router.push("/asignaciones"); return; }
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings({ companyName: d.companyName, logo: d.logo }); }).catch(() => {});
    if (u.role === "superadmin") {
      apiFetch("/api/branches").then(r => r.json()).then(b => { if (Array.isArray(b)) { setBranches(b); const ab = sessionStorage.getItem("activeBranchId"); if (ab) setActiveBranch(ab); else if (b.length) { setActiveBranch(b[0].id); setActiveBranchId(b[0].id); } } }).catch(() => {});
    } else { setActiveBranch(u.branchId || ""); }
  }, [router]);


  async function load() {
    setLoading(true);
    try {
      const origin = await publicBase();
      const res = await apiFetch(`/api/${kind}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.items || data.results || []);
        const mapped: Item[] = list.map((it: CatalogRow) => {
          // El QR abre la ficha del equipo o consola (/equipment/print/… o /consoles/print/…)
          const qrUrl = `${origin}/${kind}/print/${it.id}`;
          const subtitle = `${it.code || ""} · Bs. ${it.price || 0}`;
          return { id: it.id, code: it.code, name: it.name, brand: it.brand, model: it.model, price: it.price ?? undefined, image: it.image, kind, qrUrl, subtitle };
        });
        setItems(mapped);
      }
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- carga la lista al abrir o al cambiar de tipo
    setSelected({});
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  const toggleAll = () => {
    if (que === "fichas") {
      const todas = filteredItems.every(i => fichaElegida(i.id));
      if (todas) setFichas(fs => fs.filter(f => !filteredItems.some(i => i.id === f.id)));
      else filteredItems.filter(i => !fichaElegida(i.id)).forEach(alternarFicha);
      return;
    }
    const allSelected = filteredItems.every(i => selected[i.id]);
    const next: Record<string, boolean> = { ...selected };
    filteredItems.forEach(i => { next[i.id] = !allSelected; });
    setSelected(next);
  };

  const filteredItems = items.filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || "").toLowerCase().includes(search.toLowerCase()) || (i.brand || "").toLowerCase().includes(search.toLowerCase()));
  const paged = usePaged(filteredItems, PAGE_SIZE, `${kind}|${search}`);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedItems = items.filter(i => selected[i.id]);

  const print = () => {
    if (selectedCount === 0) return;
    // Guardar datos en sessionStorage para la vista de impresión
    const data = {
      items: selectedItems,
      size, showLogo,
      companyName: settings.companyName,
      logo: settings.logo,
      kind,
    };
    sessionStorage.setItem("qrBatchData", JSON.stringify(data));
    window.open("/qr-batch/print", "_blank");
  };

  const imprimirFichas = () => {
    if (!fichas.length) return;
    sessionStorage.setItem("fichasBatch", JSON.stringify(fichas.map(f => ({ kind: f.kind, id: f.id }))));
    window.open("/qr-batch/fichas", "_blank");
  };
  const hojas = Math.ceil(fichas.length / 2);

  if (!user) return null;

  const meta = KIND_LABEL[kind];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--sidebar-text); transition: 0.15s; transition-property: var(--tr-ui); text-align: left; }
        @media (hover: hover) and (pointer: fine) { .sidebar-btn:hover { background: rgba(var(--accent-bright-rgb), 0.05); color: var(--text-secondary); } }
        .sidebar-btn.active { background: rgba(var(--accent-bright-rgb), 0.07); color: var(--accent); }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: var(--sidebar-item); color: var(--sidebar-text); }
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
        }
      `}</style>

      <AppSidebar user={user} />

      {/* MAIN */}
      <div className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Imprimir QR múltiples</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{que === "qr" ? "Selecciona items y genera una hoja tamaño carta con stickers QR listos para imprimir" : "Elige equipos y consolas: salen sus fichas de venta de a dos por hoja carta, con línea para cortar"}</p>
        </div>

        {/* Qué imprimir (en un bloque: así se alinea con el resto de la página) */}
        <div>
          <div role="radiogroup" aria-label="Qué imprimir" style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            {([["qr", "Etiquetas QR", <Tag key="t" size={14} strokeWidth={STROKE} aria-hidden="true" />], ["fichas", "Fichas en media hoja", <Columns2 key="c" size={14} strokeWidth={STROKE} aria-hidden="true" />]] as const).map(([k, label, ic]) => (
              <button key={k} role="radio" aria-checked={que === k} onClick={() => cambiarQue(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", border: "none", background: que === k ? "var(--text-primary)" : "var(--bg-card)", color: que === k ? "#fff" : "var(--text-secondary)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{ic} {label}</button>
            ))}
          </div>
        </div>

        {/* Selector tipo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {(Object.keys(KIND_LABEL) as Kind[]).map(k => {
            const m = KIND_LABEL[k];
            const active = kind === k && !verElegidas;
            return (
              <button key={k} onClick={() => { setKind(k); setVerElegidas(false); }} style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", background: active ? `${m.color}15` : "var(--bg-card)", border: `1px solid ${active ? m.color + "40" : "var(--border)"}`, color: active ? m.color : "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>
                {m.label}
              </button>
            );
          })}
          {que === "fichas" && <button onClick={() => setVerElegidas(true)} style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", background: verElegidas ? "var(--bg-hover)" : "var(--bg-card)", border: `1px solid ${verElegidas ? "var(--text-faint)" : "var(--border)"}`, color: verElegidas ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>Elegidas ({fichas.length})</button>}
        </div>

        {/* Controles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Buscar artículo" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ flex: 1, minWidth: 200, padding: "9px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12 }} />
          <button onClick={toggleAll} style={{ padding: "9px 16px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {filteredItems.every(i => que === "fichas" ? fichaElegida(i.id) : selected[i.id]) ? "Deseleccionar todos" : `Seleccionar todos (${filteredItems.length})`}
          </button>
          {que === "qr" && <><div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)" }}>
            {(["S", "M", "L"] as const).map(s => (
              <button key={s} onClick={() => setSize(s)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: size === s ? "var(--accent)" : "transparent", color: size === s ? "#fff" : "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} />
            Logo empresa
          </label></>}
        </div>

        {que === "qr" ? (<>
        {/* Botón imprimir */}
        <div style={{ position: "sticky", top: 8, zIndex: 10, marginBottom: 16, padding: "12px 16px", background: selectedCount > 0 ? "rgba(var(--accent-bright-rgb), 0.05)" : "var(--bg-card)", border: `1px solid ${selectedCount > 0 ? "rgba(var(--accent-bright-rgb), 0.14)" : "var(--border)"}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: selectedCount > 0 ? "var(--accent-dim)" : "var(--text-muted)" }}>{selectedCount}</strong> items seleccionados
            {selectedCount > 0 && <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>· ≈ {Math.ceil(selectedCount / (size === "S" ? 24 : size === "M" ? 12 : 6))} página{Math.ceil(selectedCount / (size === "S" ? 24 : size === "M" ? 12 : 6)) !== 1 ? "s" : ""}</span>}
          </div>
          <button onClick={print} disabled={selectedCount === 0} style={{ padding: "10px 22px", background: selectedCount > 0 ? "var(--accent)" : "var(--bg-tertiary)", border: "none", borderRadius: 10, color: selectedCount > 0 ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: selectedCount > 0 ? "pointer" : "not-allowed", opacity: selectedCount > 0 ? 1 : 0.5 }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir hoja carta</button>
        </div>
        </>) : (<>
        {/* Botón imprimir fichas */}
        <div style={{ position: "sticky", top: 8, zIndex: 10, marginBottom: 16, padding: "12px 16px", background: fichas.length > 0 ? "rgba(var(--accent-bright-rgb), 0.05)" : "var(--bg-card)", border: `1px solid ${fichas.length > 0 ? "rgba(var(--accent-bright-rgb), 0.14)" : "var(--border)"}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: fichas.length > 0 ? "var(--accent-dim)" : "var(--text-muted)" }}>{fichas.length}</strong> ficha{fichas.length !== 1 ? "s" : ""}
            {fichas.length > 0 && <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>· salen {hojas} hoja{hojas !== 1 ? "s" : ""}{fichas.length % 2 ? " (la última mitad queda en blanco)" : ""}</span>}
          </div>
          <button onClick={imprimirFichas} disabled={fichas.length === 0} style={{ padding: "10px 22px", background: fichas.length > 0 ? "var(--accent)" : "var(--bg-tertiary)", border: "none", borderRadius: 10, color: fichas.length > 0 ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: fichas.length > 0 ? "pointer" : "not-allowed", opacity: fichas.length > 0 ? 1 : 0.5 }}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /> Imprimir fichas</button>
        </div>
        </>)}

        {/* Grid de items */}
        {que === "fichas" && verElegidas ? (
          fichas.length === 0 ? <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>Todavía no elegiste fichas</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {fichas.map((f, i) => (
                <div key={f.id} style={{ padding: 10, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--bg-hover)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{KIND_LABEL[f.kind].label} · Hoja {Math.floor(i / 2) + 1}{f.code ? ` · ${f.code}` : ""}</div>
                  </div>
                  <button onClick={() => setFichas(fs => fs.filter(x => x.id !== f.id))} aria-label={`Quitar ${f.name}`} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={14} strokeWidth={STROKE} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>Cargando {meta.label.toLowerCase()}...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>No hay {meta.label.toLowerCase()} disponibles</div>
        ) : (
          <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {paged.items.map(it => {
              const isSel = que === "fichas" ? fichaElegida(it.id) : !!selected[it.id];
              return (
                <div role="button" tabIndex={0} onKeyDown={pressKey} key={it.id} aria-pressed={isSel} onClick={() => que === "fichas" ? alternarFicha(it) : setSelected(s => ({ ...s, [it.id]: !s[it.id] }))} style={{ padding: 10, background: "var(--bg-card)", border: `2px solid ${isSel ? meta.color : "var(--border)"}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? meta.color : "var(--border)"}`, background: isSel ? meta.color : "transparent", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isSel ? "✓" : ""}</div>
                  {it.image ? <img alt="" loading="lazy" decoding="async" src={it.image} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                    {it.subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{it.subtitle}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={paged.goTo} /></>
        )}
      </div>
    </div>
  );
}

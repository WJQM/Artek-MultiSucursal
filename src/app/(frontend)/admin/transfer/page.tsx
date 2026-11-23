"use client";
import { CircleCheck, Disc3, Gamepad2, Joystick, Laptop, Link2, Package, TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import type { AppIcon } from "@/frontend/components/icons";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveBranchId, type SessionUser } from "@/frontend/lib/api";
import { sileo } from "@/frontend/lib/toast";
import { AppSidebar } from "@/frontend/components/AppSidebar";
import { askConfirm } from "@/frontend/lib/dialog";
import { pressKey } from "@/frontend/lib/a11y";

type ItemType = "inventory" | "equipment" | "console" | "software" | "videogame";

interface TransferItem {
  id: string;
  type: ItemType;
  name: string;
  code?: string;
  brand?: string;
  price?: number;
  quantity?: number;
  image?: string;
}

const TYPE_ICON: Record<ItemType, AppIcon> = { inventory: Package, equipment: Laptop, console: Joystick, software: Disc3, videogame: Gamepad2 };
function TypeIcon({ kind, size = 14 }: { kind: ItemType; size?: number }) { const I = TYPE_ICON[kind]; return <I size={size} strokeWidth={STROKE} aria-hidden="true" />; }

const TYPE_META: Record<ItemType, { label: string; color: string; endpoint: string }> = {
  inventory: { label: "Productos", color: "#b45309", endpoint: "/api/inventory" },
  equipment: { label: "Equipos", color: "#0e7490", endpoint: "/api/equipment" },
  console: { label: "Consolas", color: "#c2410c", endpoint: "/api/consoles" },
  software: { label: "Programas", color: "#0369a1", endpoint: "/api/software" },
  videogame: { label: "Videojuegos", color: "#dc2626", endpoint: "/api/videogames" },
};

export default function TransferPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [activeType, setActiveType] = useState<ItemType>("inventory");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [transferring, setTransferring] = useState(false);
  type TransferResult = { type: string; id: string; name: string; status: "ok" | "error"; error?: string; merged?: boolean; detail?: string };
  const [lastResult, setLastResult] = useState<{ transferred: number; errors: number; targetBranch?: string; results?: TransferResult[] } | null>(null);
  const [transferQty, setTransferQty] = useState<Record<string, number>>({});

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const userData = sessionStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    const u = (() => { try { return JSON.parse(userData); } catch { return null; } })();
    if (u.role !== "superadmin") { router.push("/dashboard"); return; }
    setUser(u); // eslint-disable-line react-hooks/set-state-in-effect -- datos del navegador (sesión, dirección o servidor) al abrir la pantalla

    apiFetch("/api/branches").then(r => r.json()).then(b => {
      if (Array.isArray(b) && b.length >= 2) {
        setBranches(b);
        setSourceBranch(b[0].id);
        setTargetBranch(b[1].id);
      }
    }).catch(() => {});
  }, [router]);


  async function loadItems() {
    setLoading(true);
    try {
      // Temporalmente setear branchId al source para cargar
      setActiveBranchId(sourceBranch);
      const meta = TYPE_META[activeType];
      const res = await apiFetch(meta.endpoint);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.items || data.results || []);
        const mapped: TransferItem[] = list.map((it: Omit<TransferItem, "type">) => ({
          id: it.id,
          type: activeType,
          name: it.name,
          code: it.code,
          brand: it.brand,
          price: it.price,
          quantity: it.quantity,
          image: it.image,
        }));
        setItems(mapped);
      }
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    if (!sourceBranch) return;
    loadItems(); // eslint-disable-line react-hooks/set-state-in-effect -- carga la lista al abrir o al cambiar de sucursal o tipo
    setSelected({});
    setTransferQty({});
  }, [sourceBranch, activeType]); // eslint-disable-line react-hooks/exhaustive-deps -- se recarga solo cuando cambia lo indicado

  const toggleAll = () => {
    const filtered = getFiltered();
    const allSel = filtered.every(i => selected[i.id]);
    const next = { ...selected };
    filtered.forEach(i => { next[i.id] = !allSel; });
    setSelected(next);
  };

  const getFiltered = () => items.filter(i =>
    !search.trim() ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.code || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.brand || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedItems = items.filter(i => selected[i.id]);
  const selectedCount = selectedItems.length;

  const doTransfer = async () => {
    if (selectedCount === 0) return;
    if (sourceBranch === targetBranch) { sileo.error("Origen y destino deben ser diferentes"); return; }
    const srcName = branches.find(b => b.id === sourceBranch)?.name || "?";
    const tgtName = branches.find(b => b.id === targetBranch)?.name || "?";
    if (!await askConfirm(`¿Transferir ${selectedCount} item(s) de "${srcName}" a "${tgtName}"?\n\nEsta acción cambia la sucursal de los items seleccionados.`)) return;

    setTransferring(true);
    try {
      const payload = {
        items: selectedItems.map(i => ({ type: i.type, id: i.id, qty: i.type === "inventory" ? (transferQty[i.id] ?? i.quantity) : undefined })),
        targetBranchId: targetBranch,
      };
      const res = await apiFetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult(data);
        sileo.success(`${data.transferred} transferido(s) a ${data.targetBranch}`);
        setSelected({});
        loadItems();
      } else {
        sileo.error(data.error || "Error al transferir");
      }
    } catch {
      sileo.error("Error de red");
    }
    setTransferring(false);
  };

  const filtered = getFiltered();
  const meta = TYPE_META[activeType];

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <style>{`
        @media(max-width:1024px){
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
        }
        @media(max-width:640px){
          .main-content{padding:60px 14px 40px!important}
          .transfer-selectors{flex-direction:column!important;gap:10px!important}
          .transfer-selectors>div:first-child,.transfer-selectors>div:last-child{min-width:100%!important}
          .transfer-arrow{transform:rotate(90deg)!important;width:36px!important;height:36px!important;font-size:16px!important;align-self:center!important}
          .transfer-grid{grid-template-columns:1fr!important}
          .transfer-tabs{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch}
          .transfer-bar{flex-direction:column!important;gap:8px!important;text-align:center!important}
        }
      `}</style>
      <AppSidebar user={user} />

      <div className="main-content page-wide" style={{ marginLeft: 210, padding: "24px 28px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Transferencia entre sucursales</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Mueve productos, equipos, consolas, programas o videojuegos entre sucursales</p>
        </div>

        {branches.length < 2 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Necesitas al menos 2 sucursales para transferir inventario.
          </div>
        ) : (
          <>
            {/* Selectores origen/destino */}
            <div className="transfer-selectors" style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label htmlFor="f-admin-transfer-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Sucursal origen</label>
                <select id="f-admin-transfer-1" value={sourceBranch} onChange={e => { setSourceBranch(e.target.value); setSelected({}); }} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="transfer-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "rgba(var(--accent-bright-rgb), 0.05)", border: "1px solid rgba(var(--accent-bright-rgb), 0.10)", fontSize: 22 }}>→</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label htmlFor="f-admin-transfer-2" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Sucursal destino</label>
                <select id="f-admin-transfer-2" value={targetBranch} onChange={e => setTargetBranch(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>
                  {branches.filter(b => b.id !== sourceBranch).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            {/* Tabs categoría */}
            <div className="transfer-tabs" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {(Object.keys(TYPE_META) as ItemType[]).map(k => {
                const m = TYPE_META[k];
                const active = activeType === k;
                return (
                  <button key={k} onClick={() => { setActiveType(k); setSearch(""); }} style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", background: active ? `${m.color}15` : "var(--bg-card)", border: `1px solid ${active ? m.color + "40" : "var(--border)"}`, color: active ? m.color : "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>
                    <TypeIcon kind={k} /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Buscador + select all */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
              <input aria-label="Buscar artículo" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código, marca..." style={{ flex: 1, padding: "9px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12 }} />
              <button onClick={toggleAll} style={{ padding: "9px 16px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                {filtered.every(i => selected[i.id]) && filtered.length > 0 ? "Deseleccionar" : "Seleccionar todos"}
              </button>
            </div>

            {/* Barra transfer */}
            <div className="transfer-bar" style={{ position: "sticky", top: 8, zIndex: 10, marginBottom: 16, padding: "12px 16px", background: selectedCount > 0 ? "rgba(16,185,129,0.08)" : "var(--bg-card)", border: `1px solid ${selectedCount > 0 ? "rgba(16,185,129,0.3)" : "var(--border)"}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 13 }}>
                <strong style={{ color: selectedCount > 0 ? "var(--ok-bright)" : "var(--text-muted)" }}>{selectedCount}</strong> items seleccionados
                {selectedCount > 0 && <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>· listos para transferir</span>}
              </div>
              <button onClick={doTransfer} disabled={selectedCount === 0 || transferring || sourceBranch === targetBranch} style={{ padding: "10px 22px", background: selectedCount > 0 && sourceBranch !== targetBranch ? "linear-gradient(135deg,var(--ok-bright),var(--ok))" : "var(--bg-tertiary)", border: "none", borderRadius: 10, color: selectedCount > 0 ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: selectedCount > 0 ? "pointer" : "not-allowed", opacity: selectedCount > 0 && !transferring ? 1 : 0.5 }}>
                {transferring ? "Transfiriendo..." : `Transferir ${selectedCount > 0 ? selectedCount + " items" : ""}`}
              </button>
            </div>

            {/* Grid items */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>Cargando {meta.label.toLowerCase()}...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 13 }}>
                {items.length === 0 ? `No hay ${meta.label.toLowerCase()} en esta sucursal` : "No hay resultados para tu búsqueda"}
              </div>
            ) : (
              <div className="transfer-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {(filtered || []).map(item => {
                  const isSel = !!selected[item.id];
                  return (
                    <div tabIndex={0} onKeyDown={pressKey} key={item.id} onClick={() => { if (activeType !== "inventory") setSelected(s => ({ ...s, [item.id]: !s[item.id] })); else if (!selected[item.id]) setSelected(s => ({ ...s, [item.id]: true })); else setSelected(s => ({ ...s, [item.id]: false })); }} style={{ padding: 12, background: "var(--bg-card)", border: `2px solid ${isSel ? "var(--ok-bright)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transitionProperty: "var(--tr-ui)", transitionDuration: "0.15s" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${isSel ? "var(--ok-bright)" : "var(--border)"}`, background: isSel ? "var(--ok-bright)" : "transparent", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isSel ? "✓" : ""}</div>
                      {item.image ? (
                        <img alt="" loading="lazy" decoding="async" src={item.image} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><TypeIcon kind={activeType} size={20} /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {item.code && <span style={{ fontFamily: "monospace", color: meta.color, fontWeight: 700, marginRight: 6 }}>{item.code}</span>}
                          {item.brand && <span>{item.brand} · </span>}
                          {item.price !== undefined && <span style={{ color: "var(--ok)", fontWeight: 700 }}>Bs. {item.price}</span>}
                          {item.quantity !== undefined && <span style={{ marginLeft: 6 }}>Stock: {item.quantity}</span>}
                        </div>
                      </div>
                      {/* Campo cantidad parcial para inventario */}
                      {activeType === "inventory" && isSel && item.quantity !== undefined && item.quantity > 0 && (
                        <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Enviar:</span>
                          <input aria-label="Cantidad a enviar"
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={transferQty[item.id] ?? item.quantity}
                            onChange={e => setTransferQty(q => ({ ...q, [item.id]: Math.min(Math.max(1, parseInt(e.target.value) || 1), item.quantity!) }))}
                            style={{ width: 50, padding: "4px 6px", background: "var(--bg-tertiary)", border: "1px solid var(--ok-bright)", borderRadius: 6, color: "var(--ok)", fontSize: 13, fontWeight: 700, textAlign: "center" }}
                          />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ {item.quantity}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resultado última transferencia */}
            {lastResult && (
              <div style={{ marginTop: 20, padding: 16, background: "rgba(16,185,129,0.06)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ok)", marginBottom: 8 }}><CircleCheck size={14} strokeWidth={STROKE} aria-hidden="true" /> Última transferencia → {lastResult.targetBranch}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {lastResult.transferred} transferido(s){lastResult.errors > 0 && <span style={{ color: "var(--danger-bright)" }}> · {lastResult.errors} error(es)</span>}
                </div>
                {lastResult.results?.filter((r) => r.status === "error").map((r, i) => (
                  <div key={`e-${i}`} style={{ fontSize: 11, color: "var(--danger-bright)", marginTop: 4 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.name}: {r.error}</div>
                ))}
                {lastResult.results?.filter((r) => r.merged).map((r, i) => (
                  <div key={`m-${i}`} style={{ fontSize: 11, color: "var(--warn)", marginTop: 4 }}><Link2 size={14} strokeWidth={STROKE} aria-hidden="true" /> {r.detail}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

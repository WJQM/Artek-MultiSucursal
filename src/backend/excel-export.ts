// Exportar a Excel: un archivo .xlsx con una hoja por tema, para el contador o análisis propio.
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { getSettings } from "./company";
import { APP_TZ } from "@/shared/dates";

export const EXPORT_SHEETS = ["resumen", "ordenes", "ventas", "caja", "cierres", "inventario", "movimientos", "clientes"] as const;
export type SheetKey = (typeof EXPORT_SHEETS)[number];

const STATUS: Record<string, string> = { pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando repuestos", in_progress: "En progreso", completed: "Completado", delivered: "Entregado" };
const PAY: Record<string, string> = { cash: "Efectivo", qr: "QR" };
const REASON: Record<string, string> = { sale: "Venta", sale_edit: "Venta editada", sale_delete: "Venta eliminada", sale_undo: "Venta pasada a cotización", repair: "Orden", manual: "Ajuste manual", serial: "Números de serie", transfer: "Traspaso", create: "Alta del producto" };
const MONEY = '#,##0.00';
const DATE = "dd/mm/yyyy";
const DATETIME = "dd/mm/yyyy hh:mm";

/** Fechas en hora de Bolivia (Excel no maneja zonas: se escribe la hora local como si fuera UTC). */
const local = (d: Date | null | undefined) => {
  if (!d) return null;
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d)) p[x.type] = x.value;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
};

interface Col { header: string; key: string; width: number; fmt?: string; sum?: boolean; align?: "left" | "center" | "right" }

// ── Estilo de la marca (azul oscuro + turquesa, como el sistema) ──
const NAVY = "FF1E2A3A", TEAL = "FF0E7C86", TEAL_L = "FFE6FAFB", ZEBRA = "FFF6F8FB", LINE = "FFD9E1EC", MUTED = "FF64748B", WHITE = "FFFFFFFF";
const BS = '"Bs." #,##0.00;[Red]-"Bs." #,##0.00';
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: LINE } };

/** Colores por estado (texto, fondo) para que se lean de un vistazo */
const STATUS_COLOR: Record<string, [string, string]> = {
  "Pendiente": ["FFB45309", "FFFEF3C7"], "Diagnosticado": ["FF6D28D9", "FFEDE9FE"], "Esperando repuestos": ["FFC2410C", "FFFFEDD5"],
  "En progreso": ["FF1D4ED8", "FFDBEAFE"], "Completado": ["FF047857", "FFD1FAE5"], "Entregado": ["FF334155", "FFE2E8F0"],
  "Ingreso": ["FF047857", "FFD1FAE5"], "Egreso": ["FFB91C1C", "FFFEE2E2"], "Nota de venta": ["FF047857", "FFD1FAE5"], "Cotización": ["FF6D28D9", "FFEDE9FE"],
  "OK": ["FF047857", "FFD1FAE5"], "Stock bajo": ["FFB45309", "FFFEF3C7"], "Agotado": ["FFB91C1C", "FFFEE2E2"], "Sí": ["FF047857", "FFD1FAE5"], "No": ["FFB91C1C", "FFFEE2E2"],
};

/** Hoja carta horizontal, ajustada al ancho, con encabezado repetido y número de página */
function printSetup(ws: ExcelJS.Worksheet, headerRow: number, landscape = true) {
  ws.pageSetup = { paperSize: 1 as unknown as ExcelJS.PaperSize, orientation: landscape ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 }, printTitlesRow: `${headerRow}:${headerRow}` };
  ws.headerFooter = { oddFooter: "&L&8&K64748B&A&R&8&K64748BPágina &P de &N" };
}

/** Franja de título arriba de cada hoja */
function titleBand(ws: ExcelJS.Worksheet, ncols: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, ncols); ws.mergeCells(2, 1, 2, ncols);
  const t = ws.getCell(1, 1); t.value = title; t.font = { bold: true, size: 16, color: { argb: WHITE } }; t.fill = fill(NAVY); t.alignment = { vertical: "middle", indent: 1 };
  const st = ws.getCell(2, 1); st.value = subtitle; st.font = { size: 10, color: { argb: "FFCBD5E1" } }; st.fill = fill(NAVY); st.alignment = { vertical: "top", indent: 1 };
  ws.getRow(1).height = 30; ws.getRow(2).height = 20; ws.getRow(3).height = 8;
}

interface SheetOpts { name: string; title: string; subtitle: string; tab: string; statusKeys?: string[] }

function addSheet(wb: ExcelJS.Workbook, o: SheetOpts, cols: Col[], rows: Record<string, unknown>[]) {
  const HEAD = 4;
  const ws = wb.addWorksheet(o.name, { views: [{ state: "frozen", ySplit: HEAD, showGridLines: false }], properties: { tabColor: { argb: o.tab } } });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  titleBand(ws, cols.length, o.title, o.subtitle);
  const head = ws.getRow(HEAD);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1); cell.value = c.header;
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 }; cell.fill = fill(TEAL);
    cell.alignment = { vertical: "middle", horizontal: c.fmt === MONEY || c.sum ? "right" : "left", wrapText: true, indent: 1 };
    cell.border = { bottom: { style: "medium", color: { argb: NAVY } } };
  });
  head.height = 30;
  printSetup(ws, HEAD);
  if (!rows.length) {
    ws.mergeCells(HEAD + 1, 1, HEAD + 1, cols.length);
    const c = ws.getCell(HEAD + 1, 1); c.value = "Sin datos en este período"; c.font = { italic: true, color: { argb: MUTED } }; c.alignment = { horizontal: "center" };
    ws.getRow(HEAD + 1).height = 28;
    return ws;
  }
  rows.forEach((r, idx) => {
    const row = ws.addRow(cols.map((c) => r[c.key] ?? null));
    row.height = 18;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.fmt) cell.numFmt = c.fmt === MONEY ? BS : c.fmt;
      cell.alignment = { vertical: "middle", horizontal: c.align || (c.fmt === MONEY || c.sum ? "right" : "left"), indent: 1 };
      cell.border = { bottom: thin };
      if (idx % 2 === 1) cell.fill = fill(ZEBRA);
      cell.font = { size: 10 };
      if (o.statusKeys?.includes(c.key) && typeof cell.value === "string" && STATUS_COLOR[cell.value]) {
        const [fg, bg] = STATUS_COLOR[cell.value];
        cell.font = { size: 10, bold: true, color: { argb: fg } }; cell.fill = fill(bg); cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  });
  const last = HEAD + rows.length;
  ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD, column: cols.length } };
  if (cols.some((c) => c.sum)) {
    const total = ws.addRow([]);
    total.height = 22;
    cols.forEach((c, i) => {
      const cell = total.getCell(i + 1);
      cell.fill = fill(TEAL_L); cell.font = { bold: true, color: { argb: NAVY }, size: 10.5 };
      cell.border = { top: { style: "double", color: { argb: NAVY } } };
      cell.alignment = { vertical: "middle", horizontal: c.fmt === MONEY || c.sum ? "right" : "left", indent: 1 };
      if (i === 0) cell.value = `TOTAL (${rows.length})`;
      if (c.sum) { const L = ws.getColumn(i + 1).letter; cell.value = { formula: `SUBTOTAL(9,${L}${HEAD + 1}:${L}${last})` }; cell.numFmt = c.fmt === MONEY ? BS : (c.fmt || "#,##0"); }
    });
  }
  return ws;
}

export async function buildWorkbook(opts: { branchId: string | null; from: Date; to: Date; sheets: SheetKey[]; label: string }) {
  const { branchId, from, to, sheets } = opts;
  const w = branchId ? { branchId } : {};
  const s = await getSettings();
  const branches = new Map((await prisma.branch.findMany({ select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const users = new Map((await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const wb = new ExcelJS.Workbook();
  const company = s?.companyName || "RepairTrackQR";
  wb.creator = company;
  wb.created = new Date();
  const multi = !branchId;
  const branchLabel = branchId ? branches.get(branchId) || "" : "Todas las sucursales";
  const generated = new Intl.DateTimeFormat("es-BO", { timeZone: APP_TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const subtitle = `${company}  ·  Período: ${opts.label}  ·  ${branchLabel}`;
  const sheet = (name: string, title: string, tab: string, cols: Col[], rows: Record<string, unknown>[], statusKeys?: string[]) =>
    addSheet(wb, { name, title, subtitle, tab, statusKeys }, cols, rows);

  const range = { gte: from, lt: to };
  const repairs = await prisma.repair.findMany({ where: { ...w, OR: [{ createdAt: range }, { deliveredAt: range }] }, orderBy: { createdAt: "asc" } });
  const sales = await prisma.quotation.findMany({ where: { ...w, createdAt: range }, orderBy: { createdAt: "asc" } });
  const cash = await prisma.cashMovement.findMany({ where: { ...w, createdAt: range }, orderBy: { createdAt: "asc" } });

  const delivered = repairs.filter((r) => r.status === "delivered" && r.deliveredAt && r.deliveredAt >= from && r.deliveredAt < to);
  const saleDocs = sales.filter((q) => q.type === "sale");

  if (sheets.includes("resumen")) {
    const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    const repIncome = sum(delivered.map((r) => r.estimatedCost));
    const salesIncome = sum(saleDocs.map((q) => q.total));
    const cashIn = sum(cash.filter((c) => c.type === "income").map((c) => c.amount));
    const cashOut = sum(cash.filter((c) => c.type === "expense").map((c) => c.amount));
    const partsCost = sum(delivered.map((r) => r.partsCost || 0));
    const salesCost = sum(saleDocs.map((q) => q.costTotal || 0));
    const qr = sum([...delivered.filter((r) => r.paidWith === "qr").map((r) => r.estimatedCost), ...saleDocs.filter((q) => q.paidWith === "qr").map((q) => q.total)]);
    const totalIn = repIncome + salesIncome + cashIn, totalOut = partsCost + salesCost + cashOut, profit = totalIn - totalOut;

    const ws = wb.addWorksheet("Resumen", { views: [{ showGridLines: false }], properties: { tabColor: { argb: NAVY } } });
    // 8 columnas: A margen | B-C, D-E, F-G, H-I tarjetas
    ws.columns = [{ width: 2 }, { width: 24 }, { width: 16 }, { width: 2 }, { width: 24 }, { width: 16 }, { width: 2 }, { width: 24 }, { width: 16 }];
    ws.mergeCells("A1:I1"); ws.mergeCells("A2:I2");
    const t = ws.getCell("A1"); t.value = `${company} — Resumen del período`; t.font = { bold: true, size: 18, color: { argb: WHITE } }; t.fill = fill(NAVY); t.alignment = { vertical: "middle", indent: 1 };
    const st = ws.getCell("A2"); st.value = `Período: ${opts.label}  ·  ${branchLabel}  ·  Generado: ${generated}`; st.font = { size: 10, color: { argb: "FFCBD5E1" } }; st.fill = fill(NAVY); st.alignment = { vertical: "top", indent: 1 };
    ws.getRow(1).height = 36; ws.getRow(2).height = 22; ws.getRow(3).height = 14;

    // Tarjetas grandes (KPI)
    const card = (col: string, col2: string, label: string, value: number | { formula: string }, color: string, bg: string, fmt = BS) => {
      ws.mergeCells(`${col}4:${col2}4`); ws.mergeCells(`${col}5:${col2}5`);
      const l = ws.getCell(`${col}4`); l.value = label.toUpperCase(); l.font = { bold: true, size: 9, color: { argb: MUTED } }; l.alignment = { indent: 1, vertical: "bottom" };
      const v = ws.getCell(`${col}5`); v.value = value; v.numFmt = fmt; v.font = { bold: true, size: 20, color: { argb: color } }; v.alignment = { indent: 1, vertical: "middle", horizontal: "left" };
      for (const r of [4, 5]) for (const c of [col, col2]) { const x = ws.getCell(`${c}${r}`); x.fill = fill(bg); }
      ws.getCell(`${col}4`).border = { top: { style: "thick", color: { argb: color } } }; ws.getCell(`${col2}4`).border = { top: { style: "thick", color: { argb: color } } };
    };
    ws.getRow(4).height = 24; ws.getRow(5).height = 38;
    card("B", "C", "Ingresos", totalIn, "FF0E7C86", TEAL_L);
    card("E", "F", "Costos y gastos", totalOut, "FFB45309", "FFFEF3C7");
    card("H", "I", "Ganancia", profit, profit >= 0 ? "FF047857" : "FFB91C1C", profit >= 0 ? "FFD1FAE5" : "FFFEE2E2");
    ws.getRow(6).height = 6;
    ws.mergeCells("B7:I7");
    const m = ws.getCell("B7"); m.value = totalIn > 0 ? `Margen de ganancia: ${(profit / totalIn * 100).toFixed(1)} %  —  de cada Bs. 100 que entraron, quedaron Bs. ${Math.round(profit / totalIn * 100)} de ganancia` : "Sin ingresos en este período";
    m.font = { size: 10.5, bold: true, color: { argb: NAVY } }; m.alignment = { horizontal: "center", vertical: "middle" }; m.fill = fill(ZEBRA); ws.getRow(7).height = 22;
    ws.getRow(8).height = 12;

    // Tabla con título de sección
    let r0 = 9;
    const table = (col: "B" | "E" | "H", title: string, rows: [string, number | string, string?][], fmt = BS, startRow = r0) => {
      const c2 = String.fromCharCode(col.charCodeAt(0) + 1);
      ws.mergeCells(`${col}${startRow}:${c2}${startRow}`);
      const h = ws.getCell(`${col}${startRow}`); h.value = title; h.font = { bold: true, size: 10.5, color: { argb: WHITE } }; h.fill = fill(TEAL); h.alignment = { indent: 1, vertical: "middle" };
      ws.getRow(startRow).height = 22;
      rows.forEach(([k, v, kind], i) => {
        const rr = startRow + 1 + i;
        const a = ws.getCell(`${col}${rr}`), b = ws.getCell(`${c2}${rr}`);
        a.value = k; b.value = v; b.numFmt = typeof v === "number" ? fmt : "@";
        const isTotal = kind === "total";
        a.font = { size: 10, bold: isTotal, color: { argb: isTotal ? NAVY : "FF334155" } }; b.font = { size: 10, bold: isTotal, color: { argb: isTotal ? NAVY : "FF334155" } };
        a.alignment = { indent: 1, vertical: "middle" }; b.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
        a.border = { bottom: thin }; b.border = { bottom: thin };
        if (isTotal) { a.fill = fill(TEAL_L); b.fill = fill(TEAL_L); a.border = { top: { style: "double", color: { argb: NAVY } } }; b.border = { top: { style: "double", color: { argb: NAVY } } }; }
        else if (i % 2 === 1) { a.fill = fill(ZEBRA); b.fill = fill(ZEBRA); }
        ws.getRow(rr).height = 18;
      });
      return startRow + rows.length + 1;
    };
    const endA = table("B", "Ingresos", [["Reparaciones entregadas", repIncome], ["Ventas (notas de venta)", salesIncome], ["Otros ingresos de caja", cashIn], ["Total ingresos", totalIn, "total"], ["   cobrado por QR (banco)", qr], ["   cobrado en efectivo", Math.round((repIncome + salesIncome - qr) * 100) / 100]]);
    const endB = table("E", "Costos y gastos", [["Repuestos usados", partsCost], ["Costo de lo vendido", salesCost], ["Gastos de caja", cashOut], ["Total", totalOut, "total"]]);
    const endC = table("H", "Movimiento", [
      ["Órdenes recibidas", repairs.filter((r) => r.createdAt >= from && r.createdAt < to).length],
      ["Órdenes entregadas", delivered.length], ["Notas de venta", saleDocs.length], ["Cotizaciones", sales.length - saleDocs.length],
    ], "#,##0");
    r0 = Math.max(endA, endB, endC) + 1;

    // Ingresos por mes (o por día si el período es corto) con barra de datos
    const byDay = to.getTime() - from.getTime() <= 45 * 86_400_000;
    const keyOf = (d: Date) => { const x = local(d)!.toISOString(); return byDay ? x.slice(0, 10) : x.slice(0, 7); };
    const per = new Map<string, number>();
    for (const r of delivered) per.set(keyOf(r.deliveredAt!), (per.get(keyOf(r.deliveredAt!)) || 0) + r.estimatedCost);
    for (const q of saleDocs) per.set(keyOf(q.createdAt), (per.get(keyOf(q.createdAt)) || 0) + q.total);
    const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const perRows = [...per.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [byDay ? k.split("-").reverse().slice(0, 2).join("/") : `${MES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`, v] as [string, number]);
    const perStart = r0;
    const endPer = table("B", byDay ? "Ingresos por día" : "Ingresos por mes", perRows.length ? perRows : [["Sin ingresos", 0]], BS, perStart);
    if (perRows.length > 1) ws.addConditionalFormatting({ ref: `C${perStart + 1}:C${perStart + perRows.length}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FF5EEAD4" } } as unknown as ExcelJS.ConditionalFormattingRule] });

    // Por técnico (entregadas)
    const tech = new Map<string, { n: number; v: number }>();
    for (const r of delivered) { const k = r.technicianId ? users.get(r.technicianId) || "—" : "Sin asignar"; const c = tech.get(k) || { n: 0, v: 0 }; c.n++; c.v += r.estimatedCost; tech.set(k, c); }
    const techRows = [...tech.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 8).map(([k, c]) => [`${k} (${c.n})`, c.v] as [string, number]);
    const endTech = table("E", "Por técnico (entregadas)", techRows.length ? techRows : [["Sin entregas", 0]], BS, perStart);
    if (techRows.length > 1) ws.addConditionalFormatting({ ref: `F${perStart + 1}:F${perStart + techRows.length}`, rules: [{ type: "dataBar", priority: 2, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FF93C5FD" } } as unknown as ExcelJS.ConditionalFormattingRule] });

    // Lo más vendido
    const prod = new Map<string, number>();
    for (const q of saleDocs) { try { for (const it of JSON.parse(q.items) as { name: string; qty: number; price?: number }[]) prod.set(it.name, (prod.get(it.name) || 0) + (it.price || 0) * (it.qty || 1)); } catch { /* items mal formados */ } }
    const prodRows = [...prod.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, v] as [string, number]);
    const endProd = table("H", "Lo más vendido", prodRows.length ? prodRows : [["Sin ventas", 0]], BS, perStart);
    if (prodRows.length > 1) ws.addConditionalFormatting({ ref: `I${perStart + 1}:I${perStart + prodRows.length}`, rules: [{ type: "dataBar", priority: 3, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FFFCD34D" } } as unknown as ExcelJS.ConditionalFormattingRule] });

    const endAll = Math.max(endPer, endTech, endProd) + 1;
    ws.mergeCells(`B${endAll}:I${endAll}`);
    const note = ws.getCell(`B${endAll}`); note.value = "La ganancia es exacta solo si los productos y repuestos tienen su precio de compra cargado. Las demás hojas tienen el detalle con filtros.";
    note.font = { italic: true, size: 9, color: { argb: MUTED } };
    printSetup(ws, 1, false);
    ws.pageSetup.printTitlesRow = undefined;
  }

  if (sheets.includes("ordenes")) {
    sheet("Órdenes", "Órdenes de reparación", "FF0E7C86", [
      { header: "OT", key: "code", width: 11 }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Ingreso", key: "created", width: 14, fmt: DATE }, { header: "Entrega", key: "delivered", width: 14, fmt: DATE },
      { header: "Cliente", key: "client", width: 22 }, { header: "Celular", key: "phone", width: 14 },
      { header: "Equipo", key: "device", width: 26 }, { header: "IMEI / serie", key: "imei", width: 17 }, { header: "Problema", key: "issue", width: 30 },
      { header: "Técnico", key: "tech", width: 16 }, { header: "Estado", key: "status", width: 16 },
      { header: "Cobrado", key: "cost", width: 14, fmt: MONEY, sum: true }, { header: "Costo repuestos", key: "parts", width: 14, fmt: MONEY, sum: true },
      { header: "Ganancia", key: "profit", width: 14, fmt: MONEY, sum: true }, { header: "Pago", key: "pay", width: 10, align: "center" }, { header: "Garantía de", key: "warranty", width: 10 },
    ], repairs.map((r) => ({
      code: r.code, branch: branches.get(r.branchId), created: local(r.createdAt), delivered: local(r.deliveredAt),
      client: r.clientName || "", phone: r.clientPhone || "", device: [r.device, r.brand, r.model].filter(Boolean).join(" "), imei: r.imei || "", issue: r.issue,
      tech: r.technicianId ? users.get(r.technicianId) || "" : "", status: STATUS[r.status] || r.status,
      cost: r.status === "delivered" ? r.estimatedCost : 0, parts: r.status === "delivered" ? r.partsCost || 0 : 0,
      profit: r.status === "delivered" ? r.estimatedCost - (r.partsCost || 0) : 0, pay: r.status === "delivered" ? PAY[r.paidWith || "cash"] : "", warranty: r.warrantyOf || "",
    })), ["status"]);
  }

  if (sheets.includes("ventas")) {
    sheet("Ventas", "Ventas y cotizaciones", "FF7C3AED", [
      { header: "Código", key: "code", width: 12 }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Tipo", key: "type", width: 15 }, { header: "Fecha", key: "date", width: 17, fmt: DATETIME },
      { header: "Cliente", key: "client", width: 22 }, { header: "Celular", key: "phone", width: 14 }, { header: "Artículos", key: "items", width: 46 },
      { header: "Total", key: "total", width: 14, fmt: MONEY, sum: true }, { header: "Costo", key: "costT", width: 14, fmt: MONEY, sum: true },
      { header: "Ganancia", key: "profit", width: 14, fmt: MONEY, sum: true }, { header: "Costo completo", key: "complete", width: 10 }, { header: "Pago", key: "pay", width: 10, align: "center" },
    ], sales.map((q) => {
      const items = (() => { try { return JSON.parse(q.items) as { name: string; qty: number }[]; } catch { return []; } })();
      const isSale = q.type === "sale";
      return {
        code: q.code, branch: branches.get(q.branchId), type: isSale ? "Nota de venta" : "Cotización", date: local(q.createdAt), client: q.clientName, phone: q.clientPhone || "",
        items: items.map((i) => `${i.qty}× ${i.name}`).join(", "), total: isSale ? q.total : 0, costT: isSale ? q.costTotal || 0 : 0,
        profit: isSale ? q.total - (q.costTotal || 0) : 0, complete: isSale ? (q.costComplete ? "Sí" : "No") : "", pay: isSale ? PAY[q.paidWith || "cash"] : "",
      };
    }), ["type"]);
  }

  if (sheets.includes("caja")) {
    sheet("Caja", "Movimientos de caja", "FF16A34A", [
      { header: "Fecha", key: "date", width: 17, fmt: DATETIME }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Tipo", key: "type", width: 11 }, { header: "Categoría", key: "cat", width: 13 }, { header: "Descripción", key: "desc", width: 36 },
      { header: "Ingreso", key: "inc", width: 16, fmt: MONEY, sum: true }, { header: "Egreso", key: "exp", width: 14, fmt: MONEY, sum: true }, { header: "Registró", key: "by", width: 16 },
    ], cash.map((c) => ({ date: local(c.createdAt), branch: branches.get(c.branchId), type: c.type === "income" ? "Ingreso" : "Egreso", cat: c.category, desc: c.description, inc: c.type === "income" ? c.amount : 0, exp: c.type === "expense" ? c.amount : 0, by: c.createdByName || "" })), ["type"]);
  }

  if (sheets.includes("cierres")) {
    const fromDay = local(from)!.toISOString().slice(0, 10), toDay = local(to)!.toISOString().slice(0, 10);
    const rows = await prisma.cashClosing.findMany({ where: { ...w, day: { gte: fromDay, lt: toDay } }, orderBy: { day: "asc" } });
    sheet("Cierres de caja", "Cierres de caja", "FF15803D", [
      { header: "Día", key: "day", width: 13 }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Fondo inicial", key: "open", width: 14, fmt: MONEY }, { header: "Entregas efectivo", key: "rep", width: 14, fmt: MONEY, sum: true },
      { header: "Ventas efectivo", key: "sal", width: 14, fmt: MONEY, sum: true }, { header: "Otros ingresos", key: "in", width: 14, fmt: MONEY, sum: true },
      { header: "Gastos", key: "out", width: 14, fmt: MONEY, sum: true }, { header: "Debería haber", key: "exp", width: 14, fmt: MONEY },
      { header: "Contado", key: "cnt", width: 14, fmt: MONEY }, { header: "Diferencia", key: "diff", width: 14, fmt: MONEY, sum: true },
      { header: "Se dejó", key: "left", width: 14, fmt: MONEY }, { header: "Se retiró", key: "wd", width: 14, fmt: MONEY, sum: true },
      { header: "QR", key: "qr", width: 14, fmt: MONEY, sum: true }, { header: "QR revisado", key: "qrv", width: 9 }, { header: "Cerró", key: "by", width: 16 }, { header: "Nota", key: "notes", width: 30 },
    ], rows.map((c) => ({ day: c.day.split("-").reverse().join("/"), branch: branches.get(c.branchId), open: c.openingFloat, rep: c.cashRepairs, sal: c.cashSales, in: c.cashIn, out: c.cashOut, exp: c.expected, cnt: c.counted, diff: c.difference, left: c.leftInCash, wd: c.withdrawn, qr: c.qrTotal, qrv: c.qrVerified ? "Sí" : "No", by: c.userName || "", notes: c.notes || "" })), ["qrv"]);
  }

  if (sheets.includes("inventario")) {
    const items = await prisma.inventoryItem.findMany({ where: { ...w, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
    sheet("Inventario", "Inventario", "FFB45309", [
      { header: "Producto", key: "name", width: 34 }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Tipo", key: "kind", width: 12 }, { header: "Categoría", key: "cat", width: 14 }, { header: "Stock", key: "qty", width: 8, sum: true }, { header: "Mínimo", key: "min", width: 8 },
      { header: "Precio venta", key: "price", width: 14, fmt: MONEY }, { header: "Precio compra", key: "cost", width: 14, fmt: MONEY },
      { header: "Valor a costo", key: "vcost", width: 14, fmt: MONEY, sum: true }, { header: "Valor a venta", key: "vprice", width: 14, fmt: MONEY, sum: true }, { header: "Estado", key: "st", width: 13 },
    ], items.map((i) => ({ name: i.name, branch: branches.get(i.branchId), kind: i.kind === "part" ? "Repuesto" : "Producto", cat: i.category || "", qty: i.quantity, min: i.minStock, price: i.price, cost: i.cost || null, vcost: (i.cost || 0) * i.quantity, vprice: i.price * i.quantity, st: i.minStock > 0 && i.quantity <= i.minStock ? (i.quantity <= 0 ? "Agotado" : "Stock bajo") : "OK" })), ["st"]);
  }

  if (sheets.includes("movimientos")) {
    const rows = await prisma.stockMovement.findMany({ where: { ...w, createdAt: range }, orderBy: { createdAt: "asc" }, include: { item: { select: { name: true } } } });
    sheet("Movimientos de stock", "Movimientos de stock", "FFC2410C", [
      { header: "Fecha", key: "date", width: 17, fmt: DATETIME }, ...(multi ? [{ header: "Sucursal", key: "branch", width: 16 }] : []),
      { header: "Producto", key: "name", width: 34 }, { header: "Motivo", key: "reason", width: 18 }, { header: "Documento", key: "ref", width: 11 },
      { header: "Cantidad", key: "delta", width: 10, fmt: "+#,##0;[Red]-#,##0;0", align: "right" }, { header: "Quedó", key: "after", width: 8 }, { header: "Quién", key: "by", width: 16 },
    ], rows.map((m) => ({ date: local(m.createdAt), branch: branches.get(m.branchId), name: m.item.name, reason: REASON[m.reason] || m.reason, ref: m.refCode || "", delta: m.delta, after: m.after, by: m.userName || "" })));
  }

  if (sheets.includes("clientes")) {
    const all = await prisma.repair.findMany({ where: w, select: { clientName: true, clientPhone: true, clientEmail: true, createdAt: true, status: true, estimatedCost: true }, orderBy: { createdAt: "asc" } });
    const map = new Map<string, { name: string; phone: string; email: string; orders: number; spent: number; first: Date; last: Date }>();
    for (const r of all) {
      const key = (r.clientPhone || "").replace(/\D/g, "").slice(-8) || (r.clientName || "").trim().toLowerCase();
      if (!key) continue;
      const cur = map.get(key) || { name: r.clientName || "", phone: r.clientPhone || "", email: r.clientEmail || "", orders: 0, spent: 0, first: r.createdAt, last: r.createdAt };
      cur.orders++; if (r.status === "delivered") cur.spent += r.estimatedCost;
      cur.last = r.createdAt; if (r.clientName) cur.name = r.clientName; if (r.clientEmail) cur.email = r.clientEmail;
      map.set(key, cur);
    }
    sheet("Clientes", "Clientes", "FF2563EB", [
      { header: "Cliente", key: "name", width: 26 }, { header: "Celular", key: "phone", width: 14 }, { header: "Correo", key: "email", width: 24 },
      { header: "Órdenes", key: "orders", width: 9, sum: true }, { header: "Gastado (entregadas)", key: "spent", width: 14, fmt: MONEY, sum: true },
      { header: "Primera visita", key: "first", width: 12, fmt: DATE }, { header: "Última visita", key: "last", width: 12, fmt: DATE },
    ], [...map.values()].sort((a, b) => b.spent - a.spent).map((c) => ({ ...c, first: local(c.first), last: local(c.last) })));
  }

  return wb;
}

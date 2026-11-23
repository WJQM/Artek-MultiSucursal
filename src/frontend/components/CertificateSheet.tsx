"use client";
import { AppWindow, ChartColumn } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
// Certificado de licencia (CL) — diseño "clásico institucional". Lo usan la vista previa de
// Certificados y la página que abre el QR (/certificate-view), así ambos se ven iguales.
// Hoja carta, solo en negro (impresoras de tóner): doble filete, título con serifa, QR y firma.

export interface CertLicense { icon: React.ReactNode; kind: string; edition: string; serial: string }
export interface CertData {
  code?: string | null; clientName: string; computerName?: string | null; date: string;
  technician?: string | null; branchName?: string | null; notes?: string | null; licenses: CertLicense[];
}
export interface CertCompany { companyName: string; slogan?: string | null; logo?: string | null; phone?: string | null; address?: string | null; website?: string | null }

/** Licencias a mostrar a partir de los campos del certificado. */
export function certLicenses(c: { windowsEdition?: string | null; windowsSerial?: string | null; officeEdition?: string | null; officeSerial?: string | null }): CertLicense[] {
  const list: (CertLicense | null)[] = [
    c.windowsSerial ? { icon: <AppWindow size={18} strokeWidth={STROKE} aria-hidden="true" />, kind: "Sistema operativo", edition: c.windowsEdition || "Windows", serial: c.windowsSerial } : null,
    c.officeSerial ? { icon: <ChartColumn size={18} strokeWidth={STROKE} aria-hidden="true" />, kind: "Ofimática", edition: c.officeEdition || "Microsoft Office", serial: c.officeSerial } : null,
  ];
  return list.filter((x): x is CertLicense => !!x);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');
.cs { --cs-navy:#000; --cs-gold:#000; --cs-ink:#000; --cs-muted:#000; --cs-line:#000;
  position:relative; max-width:7.6in; margin:0 auto; background:#fff; color:var(--cs-ink); padding:30px;
  font-family:"Plus Jakarta Sans","Segoe UI",Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; box-shadow:0 10px 30px rgba(15,23,42,.10); }
.cs-frame, .cs-frame::after { position:absolute; inset:14px; border:1.5px solid var(--cs-navy); pointer-events:none; }
.cs-frame::after { content:""; inset:4px; border-width:.6px; }
.cs-in { position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:14px; padding:30px 40px 22px; }
.cs-co { display:flex; flex-direction:column; align-items:center; gap:4px; }
.cs-co img { height:46px; max-width:180px; object-fit:contain; filter:grayscale(1); }
.cs-co b { font-size:17px; color:var(--cs-navy); letter-spacing:.06em; text-transform:uppercase; }
.cs-co small { font-size:10.5px; letter-spacing:.18em; text-transform:uppercase; color:var(--cs-muted); }
.cs-co span { font-size:11px; color:var(--cs-muted); }
.cs-rule { width:42%; height:1px; background:#000; }
.cs-title { font-family:"Playfair Display", Georgia, serif; font-size:46px; line-height:1; color:var(--cs-navy); letter-spacing:.04em; margin:0; }
.cs-sub { font-size:12px; letter-spacing:.32em; text-transform:uppercase; color:var(--cs-gold); font-weight:700; margin-top:-4px; }
.cs-p { margin:0; font-size:14px; color:#000; }
.cs-who { font-family:"Playfair Display", Georgia, serif; font-size:34px; color:var(--cs-ink); margin:-4px 0 0; overflow-wrap:anywhere; }
.cs-lics { width:100%; display:flex; flex-direction:column; gap:10px; margin-top:4px; }
.cs-lic { display:grid; grid-template-columns:1fr auto; gap:4px 14px; align-items:center; text-align:left; border:1px solid var(--cs-line); border-radius:0; padding:10px 14px; }
.cs-lic b { display:block; font-size:15.5px; }
.cs-lic small { color:var(--cs-muted); font-size:12px; }
.cs-key { font-family:ui-monospace, Consolas, monospace; font-weight:700; font-size:13px; letter-spacing:.06em; background:#fff; border:1px solid #000; border-radius:0; padding:6px 10px; white-space:nowrap; }
.cs-notes { width:100%; text-align:left; background:#fff; border:1px solid var(--cs-line); border-radius:0; padding:10px 12px; font-size:13px; }
.cs-notes small { display:block; font-size:10.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--cs-muted); margin-bottom:2px; }
.cs-kv { width:100%; display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; border-top:1px solid var(--cs-line); border-bottom:1px solid var(--cs-line); padding:12px 0; }
.cs-kv span { display:block; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--cs-muted); font-weight:700; }
.cs-kv b { font-size:14px; overflow-wrap:anywhere; }
.cs-foot { width:100%; display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:end; margin-top:10px; }
.cs-qr { display:flex; gap:10px; align-items:center; text-align:left; font-size:11.5px; color:#000; }
.cs-qr img { width:78px; height:78px; border-radius:0; }
.cs-sign { border-top:1px solid #000; padding-top:5px; font-size:12px; color:#000; text-align:center; }
.cs-disc { font-size:10.5px; color:var(--cs-muted); margin:0; line-height:1.5; }
@media print { .cs { box-shadow:none; max-width:none; } }
@media screen and (max-width:640px) {
  .cs { padding:16px; }
  .cs-frame { inset:8px; }
  .cs-in { padding:22px 14px 14px; gap:12px; }
  .cs-title { font-size:34px; }
  .cs-who { font-size:26px; }
  .cs-lic { grid-template-columns:1fr; }
  .cs-key { grid-column:1 / -1; white-space:normal; overflow-wrap:anywhere; }
  .cs-kv { grid-template-columns:1fr 1fr; }
  .cs-foot { grid-template-columns:1fr; justify-items:center; }
  .cs-sign { width:70%; }
}
`;

export function CertificateSheet({ s, c, qr }: { s: CertCompany; c: CertData; qr?: string }) {
  const dateStr = new Date(c.date + "T12:00:00").toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const contact = [s.phone, s.website, s.address].filter(Boolean).join(" · ");
  const lic = c.licenses;
  return (
    <div className="cs">
      <style>{CSS}</style>
      <span className="cs-frame" aria-hidden="true" />
      <div className="cs-in">
        <div className="cs-co">
          { }
          {s.logo && <img src={s.logo} alt="" />}
          <b>{s.companyName}</b>
          {s.slogan && <small>{s.slogan}</small>}
          {contact && <span>{contact}</span>}
        </div>
        <div className="cs-rule" />
        <h1 className="cs-title">Certificado</h1>
        <div className="cs-sub">de licencia original</div>
        <p className="cs-p">Se certifica que el equipo de</p>
        <p className="cs-who">{c.clientName || "—"}</p>
        <p className="cs-p">
          {c.computerName ? <>equipo <b style={{ color: "#000" }}>{c.computerName}</b>, cuenta</> : "Cuenta"} con {lic.length === 1 ? "la siguiente licencia instalada y activada" : "las siguientes licencias instaladas y activadas"}:
        </p>
        <div className="cs-lics">
          {lic.map((l) => (
            <div key={l.kind} className="cs-lic">
              <div><b>{l.edition}</b><small>{l.kind}</small></div>
              <span className="cs-key">{l.serial}</span>
            </div>
          ))}
        </div>
        {c.notes && <div className="cs-notes"><small>Observaciones</small>{c.notes}</div>}
        <div className="cs-kv">
          <div><span>Código</span><b>{c.code || "—"}</b></div>
          <div><span>Fecha</span><b>{dateStr}</b></div>
          <div><span>Técnico</span><b>{c.technician || "—"}</b></div>
          <div><span>Sucursal</span><b>{c.branchName || "—"}</b></div>
        </div>
        <div className="cs-foot">
          <div className="cs-qr">
            { }
            {qr && <img src={qr} alt="QR para verificar" />}
            {qr && <span>Escanea para<br />verificar que este<br />certificado es real</span>}
          </div>
          <div className="cs-sign">Firma y sello del taller</div>
        </div>
        <p className="cs-disc">Las licencias indicadas son productos originales. El uso de las claves está sujeto a los términos de Microsoft Corporation.</p>
      </div>
    </div>
  );
}

"use client";
import { Award, Printer, Store, X } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";
import { closePage } from "@/frontend/lib/close-page";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalTracker } from "@/frontend/components/PortalTracker";
import { DocPrint, DocBar, qrSrc } from "@/frontend/components/DocKit";
import { CertificateSheet, certLicenses } from "@/frontend/components/CertificateSheet";
import { mouseOnly } from "@/frontend/lib/a11y";

interface Certificate {
  id: string; code: string; clientName: string; computerName: string | null;
  windowsEdition: string | null; windowsSerial: string | null;
  officeEdition: string | null; officeSerial: string | null;
  date: string; technician: string; notes: string | null;
  createdAt: string; branch?: { id: string; name: string };
}

export default function CertificateViewPage() {
  const params = useParams();
  const code = params.code as string;
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [multiple, setMultiple] = useState<Certificate[]>([]);
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; address: string | null; website: string | null }>({ companyName: "", slogan: "", logo: null, phone: null, address: null, website: null });

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
    if (!code) return;
    const branchId = new URLSearchParams(window.location.search).get("branchId");
    const url = branchId ? `/api/certificates?code=${code}&branchId=${branchId}` : `/api/certificates?code=${code}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.multiple) { setMultiple(d.certificates); }
        else if (d && d.id) { setCert(d); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code]);

  const handlePrint = () => window.print();

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 16, color: "#1e3a5f" }}>Cargando certificado...</div>;

  // Branch picker when multiple matches
  if (multiple.length > 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif", background: "var(--bg-primary)", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 500, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}><Award size={40} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>{code}</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>Este certificado existe en varias sucursales. Selecciona cuál deseas ver:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(multiple || []).map(c => (
              <a key={c.id} href={`/certificate-view/${code}?branchId=${c.branch?.id}`} style={{ padding: "14px 20px", background: "#f0f4ff", border: "2px solid var(--warn-line)", borderRadius: 12, textDecoration: "none", color: "#1e3a5f", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s" }}
                onPointerOver={mouseOnly((e) => { (e.target as HTMLElement).style.background = "#e0e7ff"; })}
                onPointerOut={mouseOnly((e) => { (e.target as HTMLElement).style.background = "#f0f4ff"; })}>
                <span><Store size={14} strokeWidth={STROKE} aria-hidden="true" /> {c.branch?.name || "Sucursal"}</span>
                <span style={{ fontSize: 12, color: "var(--accent)" }}>{c.clientName} →</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!cert) return <div style={{ padding: 60, textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 16, color: "#e44" }}>Certificado no encontrado: {code}</div>;

  const verifyQr = qrSrc(typeof window !== "undefined" ? window.location.href : "", 220);

  return (
    <div className="dk" style={{ background: "var(--bg-hover)", padding: "74px 16px 28px" }}>
      <PortalTracker />
      <DocPrint margin="10mm" />
      <style>{`@media print { .dk { background: #fff !important; padding: 0 !important; } }`}</style>

      <DocBar title={<><Award size={14} strokeWidth={STROKE} aria-hidden="true" /> <span className="doc-long">Certificado — </span>{cert.code}</>}>
        <button className="go" onClick={handlePrint}><Printer size={14} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Imprimir</span></button>
        <button onClick={closePage}><X size={18} strokeWidth={STROKE} aria-hidden="true" /><span className="btn-txt"> Cerrar</span></button>
      </DocBar>

      <CertificateSheet s={settings} qr={verifyQr} c={{
        code: cert.code, clientName: cert.clientName, computerName: cert.computerName, date: cert.date,
        technician: cert.technician, branchName: cert.branch?.name, notes: cert.notes, licenses: certLicenses(cert),
      }} />
    </div>
  );
}

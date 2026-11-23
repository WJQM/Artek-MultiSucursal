"use client";
import { useEffect, useState } from "react";
import { publicBase } from "@/frontend/lib/public-base";
import { useParams } from "next/navigation";
import { apiFetch } from "@/frontend/lib/api";
import { ProductPrint } from "@/frontend/components/ProductPrint";
import { equipmentFicha, type EquipmentLike } from "@/frontend/lib/fichas";

type Equipment = EquipmentLike;

export default function EquipmentFichaPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [settings, setSettings] = useState<{ companyName: string; slogan: string; logo: string | null; phone: string | null; email: string | null; address: string | null }>({
    companyName: "", slogan: "", logo: null, phone: null, email: null, address: null,
  });

  useEffect(() => {
    publicBase().then(setBaseUrl);
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    apiFetch("/api/equipment").then(r => r.ok ? r.json() : []).then((items: Equipment[]) => {
      if (Array.isArray(items)) {
        const found = items.find(it => it.id === id);
        if (found) setEquipment(found);
        else setNotFound(true);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16 }}>Cargando ficha técnica...</div>;
  if (notFound || !equipment) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Equipo no encontrado</div>;

  return <ProductPrint s={settings} {...equipmentFicha(equipment, baseUrl)} />;
}

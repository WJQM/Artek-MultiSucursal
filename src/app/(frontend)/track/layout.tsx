import { portalMetadata } from "@/backend/portal-metadata";

// Clientes: al instalar desde aquí se instala la app del PORTAL
export const generateMetadata = portalMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

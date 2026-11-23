import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  poweredByHeader: false,
  // Solo modo desarrollo: permite abrir el sistema desde el celular por la red WiFi local
  // (http://192.168.x.x:3000). Next 16 lo bloquea por defecto y la página carga a medias.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // El ícono de la pestaña es el logo de Configuración (antes era el ícono por defecto de Next/Vercel)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/brand/icon?size=32" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Las imágenes subidas nunca se ejecutan como página
      { source: "/uploads/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }] },
    ];
  },
};

export default nextConfig;

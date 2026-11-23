// Borra archivos que se eliminaron en versiones anteriores.
// Al actualizar descomprimiendo el ZIP encima de la carpeta, los archivos viejos quedan
// y pueden romper la compilación (p. ej. chakra-provider.tsx) o chocar con rutas nuevas (public/manifest.json).
// Se ejecuta solo antes de dev/build.
import { existsSync, readdirSync, rmSync } from "node:fs";

const OBSOLETOS = [
  "src/app/chakra-provider.tsx",        // v14: Chakra UI eliminado
  "public/manifest.json",               // v9: el manifiesto ahora es dinámico (src/app/manifest.json/route.ts)
  "src/components/PortalControls.tsx",  // portal sin traducción al inglés
  "src/lib/portal-i18n.ts",
  "src/lib/use-portal.ts",
  "src/middleware.ts",
  "src/lib/setup-code.ts",               // v20: ya no hay código de acceso                  // v15: Next 16 lo renombró a src/proxy.ts
];

for (const f of OBSOLETOS) {
  if (existsSync(f)) {
    rmSync(f, { force: true });
    console.log(`[limpieza] eliminado archivo obsoleto: ${f}`);
  }
}

// v72: el código se ordenó en src/backend, src/frontend y src/shared, y las rutas en
// src/app/(backend) y src/app/(frontend). Si quedaron las carpetas viejas (ZIP encima),
// se borran: si no, habría dos páginas para la misma dirección y la compilación falla.
if (existsSync("src/backend") && existsSync("src/frontend")) {
  for (const d of ["src/lib", "src/components"]) {
    if (existsSync(d)) {
      rmSync(d, { recursive: true, force: true });
      console.log(`[limpieza] eliminada carpeta vieja: ${d}`);
    }
  }
}
for (const grupo of ["(backend)", "(frontend)"]) {
  const dir = `src/app/${grupo}`;
  if (!existsSync(dir)) continue;
  for (const nombre of readdirSync(dir)) {
    const viejo = `src/app/${nombre}`;
    if (existsSync(viejo)) {
      rmSync(viejo, { recursive: true, force: true });
      console.log(`[limpieza] eliminada ruta vieja: ${viejo} (ahora en ${dir})`);
    }
  }
}

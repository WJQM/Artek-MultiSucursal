# RepairTrackQR — guía para Claude Code

Sistema de gestión de un taller de reparación (órdenes con QR, portal del cliente, inventario, ventas, caja) con varias sucursales.
En producción en https://degree-project.com (VPS OVH, Nginx + PM2 + PostgreSQL).

## Cómo trabajar con el dueño
- **Responder siempre en español**, en palabras simples (lo usa también desde el celular).
- **Antes de modificar algo, mostrar una propuesta o maqueta visual** y esperar el visto bueno. Para preguntas ("¿por qué…?", "¿cómo…?"), responder antes de tocar código.
- No cambiar el diseño de la interfaz si no lo pidió. Papel de impresión: **carta** (letter), nunca A4.
- Un cambio = un commit con mensaje en español (`pNN: título`). Probar antes de entregar: `npx tsc --noEmit`, `npm run lint` (no aumentar errores existentes) y `npm run build`.
- Nunca subir `.env`, `public/uploads` ni claves. Las claves de servicios (SMTP, R2, Telegram, Anthropic, IMEI) se guardan en la base (KeyValue) y nunca se devuelven al navegador.

## Carpetas
| Carpeta | Qué va ahí |
| --- | --- |
| `src/app/(backend)/` | Rutas del servidor: `api/…`, `uploads/`, `manifest*.json` |
| `src/app/(frontend)/` | Pantallas (dashboard, portal, seguimiento, admin…) |
| `src/app/` | Solo `layout.tsx`, `globals.css`, `providers.tsx` (los exige Next.js) |
| `src/backend/` | Código que corre solo en el servidor (Prisma, auth, WhatsApp, correo, tareas…) — `@/backend/…` |
| `src/frontend/components/` | Componentes de pantalla — `@/frontend/components/…` |
| `src/frontend/lib/` | Ayudas del navegador (`apiFetch`, toasts, en vivo, animaciones…) — `@/frontend/lib/…` |
| `src/shared/` | Lo usan los dos lados, sin base de datos ni navegador (fechas, errores, horarios…) — `@/shared/…` |

Los paréntesis de `(backend)` y `(frontend)` no cambian las direcciones (`/dashboard`, `/api/…` siguen iguales). Un archivo con `"use client"` nunca importa de `@/backend` (lo haría fallar en el navegador); los `layout.tsx` del servidor sí pueden (metadatos).

## Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript. Estilos en línea (`style={{…}}`) y `src/app/globals.css`.
- Prisma 7 + PostgreSQL (`prisma/schema.prisma`). Migraciones SQL **a mano** en `prisma/migrations/AAAAMMDD_nombre/migration.sql`, idempotentes (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`). Se aplican con `npx prisma migrate deploy`.
- Zona horaria del negocio: `America/La_Paz` (`src/shared/dates.ts`: `startOfDay`, `zonedMidnight`, `todayISO`…). Moneda: `Bs.`
- Roles: `superadmin` (todas las sucursales; entra por `/setup`), `admin` (su sucursal), `tech` (solo sus órdenes). Helpers en `src/backend/auth.ts` (`getUserFromToken`, `requireAdmin`, `canAccessBranch`, `getEffectiveBranchId` — el superadmin elige sucursal con el header `x-branch-id`).
- En el cliente, usar `apiFetch` (`src/frontend/lib/api.ts`), que agrega token y sucursal.
- Páginas internas protegidas en `src/proxy.ts` (`PROTECTED_PREFIXES`): agregar ahí cada página nueva del personal.
- Menú lateral: `src/frontend/components/AppSidebar.tsx` (`GROUPS`).
- Configuración guardada en la tabla KeyValue: `readKV` / `writeKV` (`src/backend/automation.ts`).
- Tareas diarias: `src/backend/scheduler.ts` (corre en producción o con `TAREAS=1`).
- Avisos: campana (`Notification`), celular Web Push y Telegram con `sendPush(userIds, categoría, …)` en `src/backend/push.ts`. WhatsApp con `sendWhatsAppSafe` (`src/backend/whatsapp.ts`, WasenderAPI). Correo en `src/backend/mail.ts`.
- Actualización en vivo entre pantallas: `useLiveRefresh(["Modelo"], …)` (`src/frontend/lib/live.ts`).
- En celular, una regla global convierte en 1 columna los grids (`.form-grid`); para filas que deben mantenerse, usar flex.

## Módulos principales (`src/backend`)
| Archivo | Qué hace |
| --- | --- |
| `stock-moves.ts` | Stock en el servidor con historial (`StockMovement`): ventas, repuestos de órdenes, ganancia |
| `stock.ts` | Avisos de stock bajo y lista de compra |
| `cash-closing.ts` | Cierre de caja (esperado vs contado) |
| `daily-summary.ts` | Resumen del día (WhatsApp al dueño) |
| `performance.ts` | Rendimiento por técnico |
| `excel-export.ts` | Exportación a Excel (exceljs) |
| `appointments.ts` | Citas desde el portal |
| `google-reviews.ts` | Reseñas en Google |
| `telegram.ts`, `ai.ts`, `imei.ts`, `cloud.ts`, `monitor.ts`, `payments.ts` | Integraciones configurables en Configuración › Tareas automáticas |

El historial completo de cambios está en `CAMBIOS.md`; seguridad en `SEGURIDAD.md`; despliegue en `deploy/`.

## Probar en local
```
npm install
npm run dev          # http://localhost:3000
```
Necesita `.env` con `DATABASE_URL` (ver README). Sin claves de WhatsApp/servicios, esas funciones simplemente no envían.

## Publicar en el servidor
1. Commit y `git push` a GitHub.
2. En el servidor: `sudo bash /var/www/repairtrack/deploy/actualizar.sh --git` (instala dependencias, aplica migraciones y reinicia PM2).
3. En el navegador: Ctrl+Shift+R.

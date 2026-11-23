# RepairTrackQR - Multi-Sucursal

Sistema de seguimiento de reparaciones con soporte multi-sucursal, QR tracking, inventario, cotizaciones, y más.

## Stack
- **Frontend/Backend**: Next.js 16 + React 19
- **Base de datos**: PostgreSQL + Prisma 7
- **Auth**: JWT (jose + jsonwebtoken)
- **Estilos**: Tailwind CSS 4

## Roles
- **superadmin**: Acceso total, gestiona sucursales y usuarios globalmente
- **admin**: Gestiona su sucursal asignada
- **tech**: Solo ve sus reparaciones asignadas

## Credenciales por defecto (seed)
- Super Admin: `super@repairtrack.com` / `admin123` (entra por `/setup`)
- Admin Central: `admin.central@repairtrack.com` / `admin123`
- Admin Norte: `admin.norte@repairtrack.com` / `admin123`
- El Super Admin entra por `/setup` (o tocando 5 veces el logo del login) con correo + contraseña + PIN de WhatsApp. No hay código de acceso.
- Super Admin nuevos: los crea otro Super Admin en **Administración → Usuarios** (con celular). En una instalación sin ningún Super Admin, `/setup` ofrece "Crear primer Super Admin".
- Emergencia (perdió el celular): en el servidor `npx tsx scripts/reset-access.ts correo@x.com --celular 71234567`.

> ⚠️ Cambia estas contraseñas después de instalar. Ver `SEGURIDAD.md`.

---

## Desarrollo local (tu PC)

Requisitos: Node.js 20+ y PostgreSQL.

```bash
npm install
# .env ya viene configurado; revisa DATABASE_URL (usuario/contraseña de tu PostgreSQL)
npx prisma migrate deploy      # aplica las migraciones nuevas
npm run dev                    # modo desarrollo (Turbopack): arranca en http://localhost:3000
```

Tres formas de arrancar:

| Comando | Para qué | Velocidad |
|---|---|---|
| `npm run dev` | Mientras se modifica el código (Turbopack, recarga al guardar) | La 1ª vez que abres cada pantalla tarda unos segundos; después es instantáneo |
| `npm run dev:webpack` | Igual, con el compilador anterior (solo si Turbopack diera algún problema) | Más lento la 1ª vez |
| `npm run local` | Usar el sistema a diario en tu PC, como en el servidor | Todas las pantallas rápidas desde la 1ª visita (el build tarda unos minutos una sola vez) |

**Base de datos nueva** (vacía): antes de `migrate deploy` crea la base
(`CREATE DATABASE repairtrack;`) y después carga los datos de ejemplo con `npx tsx prisma/seed.ts`.

**Si `migrate deploy` da el error P3005** ("the database schema is not empty"), tu base se creó
con `prisma db push` y no tiene historial de migraciones. Marca las migraciones antiguas como ya
aplicadas y luego aplica las nuevas (las nuevas son seguras aunque algo ya exista):

PowerShell (Windows):
```powershell
Get-ChildItem prisma/migrations -Directory | Where-Object { $_.Name -le "20260421_add_review" } | ForEach-Object { npx prisma migrate resolve --applied $_.Name }
npx prisma migrate deploy
```
Bash (Linux/Mac/servidor):
```bash
for m in $(ls prisma/migrations | grep -v toml); do [[ "$m" < "20260422" ]] && npx prisma migrate resolve --applied "$m"; done
npx prisma migrate deploy
```

### PIN de verificación en local
Los admins necesitan un PIN al entrar. Para no enviar WhatsApp reales mientras pruebas,
agrega al `.env` local:
```
OTP_CONSOLE=1
```
El PIN aparecerá en la terminal donde corre `npm run dev` (línea `[OTP-DEV]`).
Quítalo si quieres probar el envío real por WhatsApp. En producción esta opción no tiene efecto.

> Ojo: con `WASENDER_API_KEY` en el `.env` local, crear/actualizar OTs con celular **sí envía
> WhatsApp reales a los clientes**. Si usas datos reales para probar, deja la clave vacía en local.

### Probar desde el celular (misma red WiFi)
```bash
npm run dev -- -H 0.0.0.0
```
y abre `http://IP-DE-TU-PC:3000` en el celular (la IP la ves con `ipconfig` en Windows).
La instalación como app (PWA) y la cámara del escáner requieren HTTPS, así que eso se prueba
recién en el servidor con dominio.

### Probar el modo producción en tu PC
```bash
npm run build
npm start
```
Si lo abres desde otro dispositivo por `http://IP` (sin HTTPS), agrega `COOKIE_INSECURE=1`
al `.env`; si no, la sesión no se guarda y vuelve al login.

---

## Publicar en un servidor (OVHcloud / Hetzner)

Guías paso a paso (contratar, dominio, HTTPS con certbot, Nginx, PM2, respaldos y primer uso):

- **[deploy/GUIA-OVHCLOUD.md](deploy/GUIA-OVHCLOUD.md)** — VPS-1 de OVHcloud (el elegido)
- [deploy/GUIA-HETZNER.md](deploy/GUIA-HETZNER.md) — Hetzner Cloud

Funcionan en cualquier VPS con Ubuntu 24.04.

Archivos del despliegue:

| Archivo | Para qué |
|---|---|
| `deploy/actualizar.sh` | Actualiza desde un ZIP o git: respalda, instala, migra, compila y reinicia sin tocar `.env` ni imágenes |
| `deploy/ecosystem.config.cjs` | Configuración de PM2 (arranque automático, reinicio si se cae) |
| `deploy/nginx-repairtrack.conf` | Plantilla de Nginx (imágenes desde `UPLOAD_DIR`) |
| `scripts/backup-diario.sh` / `restore-backup.sh` | Respaldo y restauración (leen la base de datos del `.env`) |
| `scripts/empezar-limpio.ts` | Borra los datos de prueba conservando el Super Admin y la Configuración |
| `scripts/reset-access.ts` | Emergencia: recuperar el acceso de una cuenta |

Actualizar a una versión nueva:

```bash
bash /var/www/repairtrack/deploy/actualizar.sh /root/RepairTrackQR-MultiSucursal-vXX.zip
```

---

## Subir a GitHub (primera vez, desde tu PC)

```bash
git init
git add .
git commit -m "RepairTrackQR Multi-Sucursal v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/RepairTrackQR.git
git push -u origin main
```

---

## Créditos

Proyecto de grado de Ingeniería de Sistemas (Universidad Salesiana de Bolivia), desarrollado para el taller de servicio técnico **Artek** de La Paz.

El sistema se construyó con la ayuda de **[Claude](https://www.anthropic.com/claude)** (Anthropic), usado a través de **[Claude Code](https://claude.com/claude-code)** como asistente de programación: propuso y escribió buena parte del código, las pruebas y la documentación, siempre revisados y aprobados por el autor. Los commits hechos con su ayuda llevan la línea `Co-Authored-By: Claude`.

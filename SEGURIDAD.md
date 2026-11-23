# Cambios de seguridad (septiembre 2026)

## Qué se corrigió

| # | Problema | Solución |
|---|----------|----------|
| 1 | Cualquiera podía crear un Super Admin con `POST /api/auth/register` y entrar mandando el header `x-from: setup`. El código `RTQR-2026` estaba visible en el navegador. | El código ahora vive en `SETUP_CODE` (.env) y se verifica en el servidor. Registrar o entrar como Super Admin exige ese código. Registro público solo crea admin/técnico **pendientes de aprobación**. |
| 2 | `/api/whatsapp` enviaba mensajes sin sesión (uso libre de tu cuenta Wasender). | Requiere sesión + límite de 60 mensajes/hora por usuario. |
| 3 | `/api/upload` aceptaba cualquier archivo con extensión elegida por el usuario (.html, .svg → XSS). | Se valida el contenido real (JPG/PNG/WEBP/GIF/AVIF) y la extensión la pone el servidor. Sin sesión: máx. 5 subidas/hora (foto de registro). |
| 4 | `/api/track/OT-N`, cotizaciones y certificados por código devolvían teléfono, email, notas internas y claves de Windows/Office a cualquiera. | Público: nombre abreviado ("Juan P."), teléfono oculto ("•••••567"), claves ocultas salvo los últimos 5 caracteres, sin email ni IDs internos. El personal con sesión ve todo. Límite de 60 consultas / 10 min por IP. |
| 5 | Un admin o técnico podía editar/borrar datos de **otra sucursal** con solo conocer el ID. Técnicos podían borrar inventario, cotizaciones, etc. | Todas las modificaciones verifican la sucursal. Catálogo, documentos y categorías: solo admin/superadmin. Técnicos solo pueden cambiar estado/notas de OTs asignadas. |
| 6 | Categorías se podían sobrescribir sin sesión. | Solo admin. |
| 7 | `JWT_SECRET` tenía un valor por defecto público en el código. | Obligatorio (mín. 32 caracteres); si falta, la app no arranca. |
| — | Login sin límite de intentos. | 8 intentos fallidos por correo / 30 por IP cada 15 min. |
| — | Páginas internas (/cash, /clients, /stats, /equipment, /consoles, /videogames, /qr-batch, /reports) cargaban sin sesión. | Protegidas por el middleware. |
| — | Cabeceras de seguridad ausentes. | `nosniff`, `X-Frame-Options`, `Referrer-Policy`; `/uploads` en modo sandbox. |

Bugs arreglados de paso:
- El `.gitignore` tenía una línea corrupta (UTF-16) que ignoraba **todos** los archivos del proyecto en Git.
- Los clientes que escaneaban el QR de una cotización impresa (`/quotations/print/...`) eran enviados al login.
- Borrar una OT que tenía mensajes daba error 500.
- Borrar un usuario con certificados o mensajes fallaba.
- La tabla `KeyValue` (categorías) no tenía migración → nueva migración `20260925_add_keyvalue`.
- Las reseñas se asociaban por código OT, que se repite entre sucursales; ahora usan el ID.
- El login ya no distingue mayúsculas en el correo.

## Pasos al desplegar en el servidor

1. **Actualiza el `.env` del servidor** (el de tu PC no se sube):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # copia el resultado
   nano .env
   # JWT_SECRET="<pega aquí>"
   ```
   Al cambiar `JWT_SECRET` todos deberán volver a iniciar sesión (normal).
2. Si tu servidor aún funciona con `http://IP` (sin HTTPS), agrega `COOKIE_INSECURE=1`. Recomendado: poner un dominio con HTTPS (Certbot) y quitar esa línea.
3. `npx prisma migrate deploy` (aplica la migración de KeyValue; es segura si la tabla ya existe).
4. `npm run build` y copiar `public` y `.next/static` como siempre, luego `pm2 restart repairtrack`.
5. Agrega las dos líneas nuevas de `/uploads/` al Nginx (ver README) y `nginx -t && systemctl reload nginx`.

## Acciones manuales pendientes (no se pueden hacer desde el código)

- **Regenera tu API key de WasenderAPI**: la actual estaba dentro del ZIP del proyecto.
- **Cambia la contraseña de PostgreSQL** si el servidor usa la misma que el `.env` local.
- **Cambia las contraseñas `admin123` / `tech123`** del seed en producción.
- Revisa en *Admin → Usuarios* si hay cuentas desconocidas (especialmente superadmins) creadas antes de esta corrección, y elimínalas.

## Pendiente para una siguiente etapa

- ~~Un usuario suspendido conserva su sesión hasta 7 días~~ → resuelto: las sesiones se validan contra la base en cada petición.
- Los códigos OT son consecutivos; para evitar que se adivinen se podría agregar un token aleatorio a los enlaces QR nuevos.

---

# Doble verificación y recuperación de contraseña (septiembre 2026)

## Cómo funciona

| Situación | Qué se pide |
|---|---|
| Login, registro, `/setup`, "¿Olvidaste tu contraseña?" | Captcha Cloudflare Turnstile (si está configurado) |
| Login de **admin y superadmin** desde un dispositivo nuevo | PIN de 6 dígitos por WhatsApp **o** código de la app autenticadora **o** código de respaldo |
| Login de **técnicos** | Solo contraseña. Cada técnico puede activar el PIN en *Mi cuenta* |
| "Recordar este dispositivo" | No vuelve a pedir PIN en ese navegador por 30 días |
| Registro de usuario nuevo | Celular obligatorio, verificado con PIN por WhatsApp; luego aprobación del superadmin como antes |
| Contraseña temporal (creada por el superadmin) | Al entrar se obliga a elegir una nueva |

- PIN: 6 dígitos, vence en **10 minutos**, máximo **5 intentos**, reenvío cada 60 s y máximo 6 por hora por número. Se guarda cifrado (hash), nunca en texto plano.
- **Sesiones revocables:** cambiar/restablecer la contraseña, suspender, cambiar rol o sucursal, o "cerrar sesión en los demás dispositivos" saca al usuario **al instante** (antes seguía dentro hasta 7 días).
- Avisos por WhatsApp cuando cambia la contraseña, el celular, se activa/desactiva la app o se usa un código de respaldo.

## Pantallas nuevas
- **Login:** "¿Olvidaste tu contraseña?" → PIN por WhatsApp → nueva contraseña (si la cuenta tiene app autenticadora, también se pide ese código).
- **Menú lateral → 🔐 Mi cuenta:** cambiar contraseña, cambiar/verificar celular, activar PIN (técnicos), configurar la app autenticadora (QR generado en el propio servidor), códigos de respaldo, cerrar sesión en los demás dispositivos.
- **Admin → Usuarios:** insignias "Celular verificado", "App autenticadora", "Contraseña temporal" y botones 🔑 contraseña temporal (se puede enviar por WhatsApp), 🛡️ restablecer app autenticadora, 🚪 cerrar sus sesiones.

## Primera vez después de actualizar
- Admins y superadmin **con celular cargado**: al entrar reciben el PIN en ese número y queda verificado.
- Admins **sin celular**: al entrar se les pide registrar su celular (reciben PIN para confirmarlo).
  ⚠️ En ese momento basta la contraseña para registrar un número, así que conviene que el superadmin **cargue el celular de cada admin en Admin → Usuarios antes de actualizar**, o que los admins entren apenas se despliegue.
- **Superadmin:** entra a *Mi cuenta* y activa la **app autenticadora**. Guarda los 10 códigos de respaldo (impresos o en un lugar seguro). Así, si WhatsApp/Wasender falla, igual puedes entrar.

## Captcha (Cloudflare Turnstile) — opcional pero recomendado
1. Crea una cuenta gratis en https://dash.cloudflare.com → **Turnstile** → **Add widget**.
2. Dominio: el de tu sistema (o la IP del servidor). Modo: **Managed**.
3. Copia *Site Key* y *Secret Key* al `.env` del servidor: `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`, y reinicia (`pm2 restart repairtrack`).
Si las dejas vacías el sistema funciona igual, sin captcha.

## Si WhatsApp deja de funcionar
WasenderAPI no es la API oficial de WhatsApp; si Meta bloquea el número, no llegarán PINs. Opciones:
1. Entrar con la **app autenticadora** o un **código de respaldo** (por eso es importante configurarlos).
2. Los **técnicos** (sin PIN activado) no se ven afectados: entran solo con contraseña.
   Un **admin** sin app autenticadora no podrá entrar hasta que WhatsApp vuelva a funcionar, por eso se recomienda que **cada admin también configure la app** en *Mi cuenta*.
3. **Emergencia total** (superadmin sin app ni códigos), en el servidor por SSH:
   ```bash
   cd /var/www/repairtrack
   npx tsx scripts/reset-access.ts super@tu-correo.com            # contraseña temporal + quita la app
   npx tsx scripts/reset-access.ts super@tu-correo.com --quitar-celular   # además borra el celular (para registrar uno nuevo)
   ```

## Pasos al desplegar esta versión
1. `npx prisma migrate deploy` (migración `20260927_auth_2fa`).
2. En el `.env` del servidor agrega `ENCRYPTION_KEY` (genéralo con el comando de `.env.example`) y, si quieres captcha, las claves de Turnstile. **No cambies `ENCRYPTION_KEY` después.**
3. Verifica que `WASENDER_API_KEY` esté configurada: sin ella, en producción no se pueden enviar PINs.
4. `npm install` (nueva dependencia `qrcode`), `npm run build`, copiar `public` y `.next/static`, `pm2 restart repairtrack`.

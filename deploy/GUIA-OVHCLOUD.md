# Publicar RepairTrackQR en OVHcloud (paso a paso)

Todo se escribe en la terminal del servidor. Donde dice **TU_IP** pon la IP de tu VPS y donde
dice **TU_DOMINIO** tu dominio real, por ejemplo `taller.miempresa.com`.

| Qué | Dónde queda |
|---|---|
| Código de la app | `/var/www/repairtrack` |
| Configuración secreta | `/var/www/repairtrack/.env` |
| Imágenes subidas | `/var/lib/repairtrack/uploads` (fuera del código: no se pierden al actualizar) |
| Respaldos propios | `/root/backups` (14 días) + respaldo diario de OVHcloud |

---

## 0. Contratar el VPS

1. En **ovhcloud.com** → *Bare Metal & VPS* → **VPS** → elige **VPS-1** (2 vCore, 4 GB RAM).
2. **Localización:** la más cercana a Bolivia que tengan disponible: *Norteamérica* (Vint Hill –
   Virginia, o Beauharnois – Canadá).
3. **Sistema operativo:** **Ubuntu 24.04** (sin aplicaciones preinstaladas).
4. **Respaldo automático:** deja activado el respaldo diario (el básico viene incluido).
5. Paga y espera el correo **"Your VPS is ready"**: trae la **IP** y la contraseña del usuario
   **`ubuntu`**.

### Entrar la primera vez

Desde tu PC (PowerShell):

```powershell
ssh ubuntu@TU_IP
```

La primera vez te pide la contraseña del correo y, en algunos casos, cambiarla. Luego pasa a
administrador; **todos los pasos siguientes se hacen así**:

```bash
sudo -i
```

(Verás que el indicador cambia a `root@...`. Si cierras la ventana, al volver entra otra vez con
`ssh ubuntu@TU_IP` y `sudo -i`.)

## 1. Dominio

En el panel donde compraste el dominio crea un registro **A**:

- Nombre: `taller` (o `@` si usarás el dominio principal)
- Valor: la IP del VPS (**TU_IP**)

Puede tardar de 5 minutos a 1 hora. Compruébalo con `ping TU_DOMINIO`.

## 2. Programas del servidor (una sola vez)

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs postgresql nginx unzip certbot python3-certbot-nginx
npm install -g pm2
node -v    # debe decir v22.x
```

Memoria de intercambio (recomendado aunque el VPS-1 tenga 4 GB: la compilación usa bastante):

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Base de datos

```bash
# Contraseña nueva y larga para PostgreSQL (guárdala, va en el .env)
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'CAMBIA_ESTA_CLAVE';"
sudo -u postgres psql -c "CREATE DATABASE repairtrack;"   # si ya existe, dirá que ya existe: está bien
```

## 4. Subir el código

Desde **tu PC** (PowerShell), sube el ZIP:

```powershell
scp RepairTrackQR-MultiSucursal-v36.zip ubuntu@TU_IP:/home/ubuntu/
```

En el **servidor**:

```bash
mkdir -p /var/www/repairtrack /var/lib/repairtrack/uploads
cd /var/www/repairtrack
unzip -o -q /home/ubuntu/RepairTrackQR-MultiSucursal-v36.zip -x ".env" "public/uploads/*" "node_modules/*" ".next/*"

# Pasa a la carpeta nueva las imágenes que venían en el ZIP (si las hay):
unzip -o -q /home/ubuntu/RepairTrackQR-MultiSucursal-v36.zip "public/uploads/*" -d /tmp/rt-img 2>/dev/null && cp -an /tmp/rt-img/public/uploads/. /var/lib/repairtrack/uploads/ ; rm -rf /tmp/rt-img
```

## 5. Archivo .env

```bash
cp .env.example .env
nano .env
```

Rellena (los demás valores pueden quedar como están):

| Variable | Qué poner |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:CAMBIA_ESTA_CLAVE@localhost:5432/repairtrack` |
| `JWT_SECRET` | uno **nuevo**: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ENCRYPTION_KEY` | otro nuevo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — **no lo cambies nunca después** |
| `APP_URL` | `https://TU_DOMINIO` |
| `UPLOAD_DIR` | `/var/lib/repairtrack/uploads` |
| `WASENDER_API_KEY` | la clave de tu cuenta de WasenderAPI |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | las de Cloudflare Turnstile (agrega `TU_DOMINIO` al widget) |

No pongas `COOKIE_INSECURE` si vas a usar HTTPS (paso 7).
Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`. Protégelo: `chmod 600 .env`.

## 6. Instalar, compilar y arrancar

```bash
cd /var/www/repairtrack
bash deploy/actualizar.sh        # respaldo, dependencias, migraciones, compilación y arranque
pm2 startup systemd              # arranque automático al reiniciar el VPS
pm2 save
```

Al final debe decir **✅ Actualizado y funcionando.**

## 7. Nginx y HTTPS

```bash
cp deploy/nginx-repairtrack.conf /etc/nginx/sites-available/repairtrack
sed -i 's/TU_DOMINIO/taller.miempresa.com/' /etc/nginx/sites-available/repairtrack   # ← tu dominio
ln -sf /etc/nginx/sites-available/repairtrack /etc/nginx/sites-enabled/repairtrack
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx -d taller.miempresa.com --redirect -m tu-correo@gmail.com --agree-tos -n
```

Certbot activa HTTPS y lo renueva solo. Abre `https://TU_DOMINIO`: debe verse el login con candado.

Cortafuegos (deja pasar solo SSH y web):

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

## 8. Respaldo automático diario

> **Ya no hace falta programarlo a mano:** el sistema hace el respaldo solo todos los días (por defecto a las 03:00, guarda 7 días). Se configura en *Configuración › Tareas automáticas*, donde también ves la lista, puedes respaldar al instante y descargar. Lo de abajo (crontab) es opcional, solo como segunda copia.


```bash
crontab -e
# agrega esta línea al final:
0 3 * * * bash /var/www/repairtrack/scripts/backup-diario.sh >> /var/log/repairtrack-backup.log 2>&1
```

Pruébalo una vez a mano: `bash scripts/backup-diario.sh`. Además, OVHcloud guarda cada día una
copia de todo el VPS (panel → tu VPS → *Copia de seguridad automatizada*). De vez en cuando descarga
un respaldo a tu PC:

```bash
# En el servidor (como root): deja una copia del último respaldo donde el usuario ubuntu la pueda leer
cp "$(ls -t /root/backups/db_*.dump | head -1)" /home/ubuntu/ultimo-respaldo.dump && chown ubuntu /home/ubuntu/ultimo-respaldo.dump
```
```powershell
# En tu PC
scp ubuntu@TU_IP:/home/ubuntu/ultimo-respaldo.dump .
```

## 9. Primer uso

1. Si el servidor ya tenía datos de prueba, bórralos (conserva el Super Admin y la Configuración):
   ```bash
   cd /var/www/repairtrack
   npx tsx scripts/empezar-limpio.ts               # vista previa: no borra nada
   npx tsx scripts/empezar-limpio.ts --confirmar   # borra de verdad
   ```
   Si no hay Super Admin todavía, entra a `https://TU_DOMINIO/setup` y créalo.
2. Entra en `https://TU_DOMINIO/setup` con el Super Admin.
3. **Configuración:** nombre de la empresa, logo, ciudad, teléfono, dirección, garantía y
   **enlace público** (`https://TU_DOMINIO`).
4. **Sucursales:** crea las reales.
5. **Usuarios:** crea administradores y técnicos de cada sucursal.
6. Haz una OT de prueba con tu propio celular: te debe llegar el WhatsApp con tu enlace personal.

---

## Actualizar a una versión nueva

```powershell
# En tu PC
scp RepairTrackQR-MultiSucursal-v37.zip ubuntu@TU_IP:/home/ubuntu/
ssh ubuntu@TU_IP
```
```bash
# En el servidor
sudo -i
bash /var/www/repairtrack/deploy/actualizar.sh /home/ubuntu/RepairTrackQR-MultiSucursal-v37.zip
```

El script respalda primero, no toca tu `.env` ni tus imágenes, aplica las migraciones y
reinicia sin cortar el servicio.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La página no carga (502) | `pm2 logs repairtrack --lines 50` |
| Vuelve al login después de entrar | Estás entrando por `http://` o por IP: usa `https://TU_DOMINIO` |
| No llegan los WhatsApp | Revisa `WASENDER_API_KEY` y que el número esté conectado en WasenderAPI |
| No se ven las fotos nuevas | Revisa que `UPLOAD_DIR` del `.env` y el `alias` de Nginx sean la misma carpeta |
| La compilación se corta ("Killed") | Falta memoria: agrega el swap del paso 2 |
| Volver a un respaldo | `bash scripts/restore-backup.sh` (lista) y luego `bash scripts/restore-backup.sh FECHA` |
| No puedes entrar por SSH | Panel de OVHcloud → tu VPS → *KVM* (consola en el navegador) o *Reiniciar en modo rescate* |
| Perdiste el acceso del Super Admin | `npx tsx scripts/reset-access.ts correo@ejemplo.com --celular 7xxxxxxx` |

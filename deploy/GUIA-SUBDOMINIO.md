# Segunda copia en un subdominio (datos de prueba)

Instala una copia **separada** del sistema en `artek.degree-project.com`, en el mismo servidor donde ya
funciona `degree-project.com`, sin tocarlo:

| | Sistema actual | Copia de prueba |
| --- | --- | --- |
| Carpeta | `/var/www/repairtrack` | `/var/www/artek` |
| Base de datos | `repairtrack` | `artek` (nueva, vacía) |
| Puerto interno | 3000 | 3001 |
| Fotos | `/var/lib/repairtrack/uploads` | `/var/lib/artek/uploads` |
| Respaldos | `/root/backups` | `/root/backups-artek` |
| Nombre en PM2 | `repairtrack` | `artek` |

Los comandos se copian y pegan **de a uno**, conectado al servidor por SSH. Si un paso da error, no sigas: revisa el mensaje primero.

---

## Paso 0 — Apuntar el subdominio al servidor

En la página donde compraste `degree-project.com`, en la configuración **DNS**, agrega un registro:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | `artek` | la IP de tu servidor (la misma que tiene `degree-project.com`) |

Para ver la IP del servidor:

```bash
curl -4 -s ifconfig.me
```

Comprueba que ya apunta (puede tardar de 5 minutos a 1 hora):

```bash
getent hosts artek.degree-project.com
```

Tiene que mostrar la misma IP.

## Paso 1 — Revisar la memoria

```bash
free -h
```

En la fila `Mem`, la columna `available` debería tener al menos **1 GB** libre (la copia usa unos 300–600 MB y la compilación necesita más por un rato). Si tiene menos, avisa antes de seguir.

## Paso 2 — Descargar el código

```bash
sudo git clone https://github.com/WJQM/Artek-MultiSucursal.git /var/www/artek
```

## Paso 3 — Crear la base de datos vacía

```bash
sudo -u postgres psql -c "CREATE DATABASE artek;"
```

## Paso 4 — Crear el `.env` de la copia

Este bloque arma el `.env` nuevo. Toma el usuario y la contraseña de PostgreSQL y la clave de WhatsApp del sistema actual
(para que lleguen los PIN de ingreso), y genera claves nuevas para todo lo demás. Cópialo entero:

```bash
cd /var/www/artek
DB=$(sudo grep -E '^DATABASE_URL=' /var/www/repairtrack/.env | sed -E 's#/repairtrack([?"]|$)#/artek\1#')
WA=$(sudo grep -E '^WASENDER_API_KEY=' /var/www/repairtrack/.env)
sudo tee .env > /dev/null <<EOF
$DB
$WA
JWT_SECRET="$(openssl rand -hex 48)"
ENCRYPTION_KEY="$(openssl rand -hex 32)"
APP_URL="https://artek.degree-project.com"
PORT=3001
UPLOAD_DIR="/var/lib/artek/uploads"
BACKUP_DIR="/root/backups-artek"
EOF
sudo mkdir -p /var/lib/artek/uploads
```

Comprueba que la base sea `artek` (la contraseña sale tapada):

```bash
sudo grep DATABASE_URL /var/www/artek/.env | sed -E 's#://[^@]*@#://***@#'
```

Tiene que terminar en `/artek`. **Si dice `/repairtrack`, no sigas.**

> ¿Por qué se usa la misma clave de WhatsApp? Solo para que te llegue el PIN al iniciar sesión.
> Los datos de prueba no tienen celulares de clientes, así que la copia no le escribe a nadie real.

## Paso 5 — Instalar, compilar y arrancar

```bash
sudo bash /var/www/artek/deploy/actualizar.sh
```

Tarda unos minutos. Al final tiene que decir `✅ Actualizado y funcionando.` Para confirmar que las dos copias corren:

```bash
sudo pm2 list
```

Deben aparecer `repairtrack` y `artek`, las dos en `online`.

## Paso 6 — Nginx y HTTPS

```bash
sed -e 's/TU_DOMINIO/artek.degree-project.com/' -e 's#/var/lib/repairtrack/uploads/#/var/lib/artek/uploads/#' -e 's#127.0.0.1:3000#127.0.0.1:3001#g' /var/www/artek/deploy/nginx-repairtrack.conf | sudo tee /etc/nginx/sites-available/artek > /dev/null
```

```bash
sudo ln -sf /etc/nginx/sites-available/artek /etc/nginx/sites-enabled/artek
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

```bash
sudo certbot --nginx -d artek.degree-project.com --redirect
```

Abre `https://artek.degree-project.com` en el navegador: tiene que salir la pantalla de inicio de sesión.

## Paso 7 — Crear el Super Admin y las sucursales

1. Entra a `https://artek.degree-project.com/setup` y elige **Crear primer Super Admin** (solo aparece porque la base está vacía).
   Usa tu celular: el PIN llega por WhatsApp.
2. En **Administración › Sucursales**, crea las sucursales que quieras mostrar (por ejemplo "Sucursal Centro" y "Sucursal El Alto").

## Paso 8 — Llenar con datos de prueba

Primero la vista previa (no cambia nada):

```bash
cd /var/www/artek && sudo npx tsx scripts/seed-carga.ts --reemplazar --nivel=chico --forzar
```

Si se ve bien, créalos de verdad (~1.000 órdenes, ventas, cotizaciones, caja e inventario en tus sucursales, desde OT-1):

```bash
cd /var/www/artek && sudo npx tsx scripts/seed-carga.ts --reemplazar --nivel=chico --confirmar --forzar
```

Ningún cliente de prueba tiene celular ni correo, así que no sale ningún mensaje.

---

## Actualizar la copia más adelante

```bash
sudo bash /var/www/artek/deploy/actualizar.sh --git
```

## Quitar la copia por completo

```bash
sudo pm2 delete artek && sudo pm2 save
sudo rm -f /etc/nginx/sites-enabled/artek /etc/nginx/sites-available/artek && sudo systemctl reload nginx
sudo -u postgres psql -c "DROP DATABASE artek;"
sudo rm -rf /var/www/artek /var/lib/artek /root/backups-artek
```

El sistema de `degree-project.com` no se toca en ninguno de estos pasos.

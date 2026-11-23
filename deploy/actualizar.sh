#!/bin/bash
# ============================================================
# ACTUALIZAR RepairTrackQR en el servidor
# ============================================================
# Desde un ZIP nuevo (subido con scp a /root):
#   bash /var/www/repairtrack/deploy/actualizar.sh /root/RepairTrackQR-MultiSucursal-v36.zip
# Desde GitHub (si usas git):
#   bash /var/www/repairtrack/deploy/actualizar.sh --git
#
# Qué hace, en orden:
#   1) Respaldo de la base de datos e imágenes (por si algo sale mal)
#   2) Copia el código nuevo SIN tocar tu .env ni tus imágenes
#   3) Instala dependencias, aplica migraciones y compila
#   4) Reinicia la app sin cortar el servicio y comprueba que responde
# ============================================================
set -euo pipefail

# La carpeta del sistema es la que contiene este script (sirve para tener dos copias en el servidor)
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export APP_DIR
APP_NAME="$(basename "$APP_DIR")"
SOURCE="${1:-}"
cd "$APP_DIR"

if [ ! -f .env ]; then echo "❌ No existe $APP_DIR/.env (ver deploy/GUIA-OVHCLOUD.md)"; exit 1; fi
PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d "\"'\r")"
PORT="${PORT:-3000}"

echo "▶ 1/5 Respaldo previo"
bash "$APP_DIR/scripts/backup-diario.sh" || { echo "❌ El respaldo falló; no se actualiza."; exit 1; }

echo "▶ 2/5 Código nuevo"
if [ "$SOURCE" = "--git" ]; then
  git pull --ff-only
elif [ -n "$SOURCE" ]; then
  [ -f "$SOURCE" ] || { echo "❌ No existe el ZIP: $SOURCE"; exit 1; }
  # Nunca sobreescribir el .env del servidor ni las imágenes con las del ZIP
  unzip -o -q "$SOURCE" -x ".env" ".env.*" "public/uploads/*" "node_modules/*" ".next/*" -d "$APP_DIR"
else
  echo "   (sin ZIP ni --git: se recompila el código actual)"
fi

echo "▶ 3/5 Dependencias y base de datos"
npm ci --no-audit --no-fund
npx prisma migrate deploy

echo "▶ 4/5 Compilando (puede tardar 1-3 minutos)"
npm run build
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "▶ 5/5 Reiniciando"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi
pm2 save >/dev/null

for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/settings"; then
    echo "✅ Actualizado y funcionando."
    exit 0
  fi
  sleep 2
done
echo "⚠️  La app no responde todavía. Revisa: pm2 logs $APP_NAME --lines 50"
exit 1

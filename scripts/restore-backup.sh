#!/bin/bash
# ============================================
# RESTAURAR BACKUP — RepairTrackQR
# ============================================
#   bash scripts/restore-backup.sh                    → lista los respaldos disponibles
#   bash scripts/restore-backup.sh 2026-10-05_0300    → restaura ese respaldo
# ⚠️ Reemplaza TODOS los datos actuales por los del respaldo.
# ============================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/repairtrack}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

if [ -z "${1:-}" ]; then
  echo "Uso: $0 FECHA   (ej: 2026-10-05_0300)"; echo; echo "Respaldos disponibles:"
  ls "$BACKUP_DIR"/db_*.dump 2>/dev/null | sed 's|.*db_||;s|\.dump||' | sort
  exit 1
fi

set -a; . "$APP_DIR/.env"; set +a
DB_URL="${DATABASE_URL%%\?*}"
UPLOADS_DIR="${UPLOAD_DIR:-$APP_DIR/public/uploads}"
DB_FILE="$BACKUP_DIR/db_$1.dump"
UP_FILE="$BACKUP_DIR/uploads_$1.tar.gz"
[ -f "$DB_FILE" ] || { echo "❌ No existe $DB_FILE"; exit 1; }

echo "⚠️  Se reemplazarán los datos actuales por el respaldo $1"
read -r -p "Escribe SI para continuar: " ok
[ "$ok" = "SI" ] || { echo "Cancelado"; exit 0; }

pm2 stop repairtrack || true
echo "🔄 Restaurando base de datos…"
pg_restore --dbname="$DB_URL" --clean --if-exists --no-owner "$DB_FILE"
if [ -f "$UP_FILE" ]; then
  echo "🔄 Restaurando imágenes…"
  mkdir -p "$UPLOADS_DIR"
  tar -xzf "$UP_FILE" -C "$UPLOADS_DIR"
fi
pm2 start repairtrack
echo "✅ Restauración completada"

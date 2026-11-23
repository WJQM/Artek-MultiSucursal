#!/bin/bash
# ============================================
# BACKUP DIARIO — RepairTrackQR
# ============================================
# Lee la base de datos (DATABASE_URL) y la carpeta de imágenes (UPLOAD_DIR) del .env,
# así no hay contraseñas escritas en este archivo.
#
# Programarlo todos los días a las 3 AM:
#   crontab -e
#   0 3 * * * bash /var/www/repairtrack/scripts/backup-diario.sh >> /var/log/repairtrack-backup.log 2>&1
#
# Guarda en /root/backups (o BACKUP_DIR) y conserva los últimos 14 días.
# ============================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +"%Y-%m-%d_%H%M")

set -a; . "$APP_DIR/.env"; set +a
DB_URL="${DATABASE_URL%%\?*}"          # pg_dump no entiende "?schema=public"
UPLOADS_DIR="${UPLOAD_DIR:-$APP_DIR/public/uploads}"

mkdir -p "$BACKUP_DIR"
echo "🔄 Backup $STAMP"

DB_FILE="$BACKUP_DIR/db_${STAMP}.dump"
pg_dump --dbname="$DB_URL" -Fc -Z 9 -f "$DB_FILE"
[ -s "$DB_FILE" ] || { echo "❌ ERROR al respaldar la base de datos"; exit 1; }
echo "✅ Base de datos: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

if [ -d "$UPLOADS_DIR" ]; then
  UP_FILE="$BACKUP_DIR/uploads_${STAMP}.tar.gz"
  tar -czf "$UP_FILE" --exclude=./_thumbs -C "$UPLOADS_DIR" .  # las miniaturas se vuelven a generar solas
  echo "✅ Imágenes: $UP_FILE ($(du -h "$UP_FILE" | cut -f1))"
else
  echo "⚠️  No existe la carpeta de imágenes ($UPLOADS_DIR)"
fi

find "$BACKUP_DIR" -name "db_*.dump" -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -type f -mtime +"$RETENTION_DAYS" -delete
echo "💾 Total en $BACKUP_DIR: $(du -sh "$BACKUP_DIR" | cut -f1)"

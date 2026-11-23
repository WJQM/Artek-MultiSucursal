# Scripts de mantenimiento — RepairTrackQR

Se ejecutan en el servidor, dentro de `/var/www/repairtrack`. Leen la base de datos y la carpeta
de imágenes del `.env` (no hay contraseñas escritas en los scripts).

| Script | Uso |
|---|---|
| `backup-diario.sh` | `bash scripts/backup-diario.sh` — respaldo de la base de datos e imágenes en `/root/backups` (14 días) |
| `restore-backup.sh` | `bash scripts/restore-backup.sh` lista los respaldos; `bash scripts/restore-backup.sh FECHA` restaura uno |
| `empezar-limpio.ts` | `npx tsx scripts/empezar-limpio.ts` vista previa; `--confirmar` borra los datos de prueba (conserva Super Admin y Configuración) |
| `reset-access.ts` | `npx tsx scripts/reset-access.ts correo@ejemplo.com [--celular 7xxxxxxx]` — emergencia: recuperar una cuenta |
| `seed-carga.ts` | `npx tsx scripts/seed-carga.ts --nivel=chico|medio|grande|enorme` llena con datos falsos para probar cuánto aguanta (sin celulares ni correos); `--borrar` los quita. Con `--reemplazar --confirmar` borra tus órdenes y catálogo y crea todo desde OT-1 en tus sucursales. **No usar en producción** |
| `limpiar-obsoletos.mjs` | Se ejecuta solo antes de `dev`/`build`: borra archivos de versiones anteriores |

Respaldo automático todos los días a las 3 AM (`crontab -e`):

```
0 3 * * * bash /var/www/repairtrack/scripts/backup-diario.sh >> /var/log/repairtrack-backup.log 2>&1
```

La guía completa del servidor está en `deploy/GUIA-HETZNER.md`.

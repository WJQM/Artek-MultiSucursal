// PM2 — mantiene RepairTrackQR encendido y lo reinicia solo si se cae o si el servidor reinicia.
//   pm2 start deploy/ecosystem.config.cjs     (primera vez)
//   pm2 reload repairtrack                     (después de actualizar)
//   pm2 logs repairtrack                       (ver errores)
// El nombre en PM2 es el de la carpeta (/var/www/repairtrack → "repairtrack") y el puerto sale de
// PORT en el .env (3000 si no está). Así se pueden tener dos copias en el mismo servidor.
const fs = require("fs");
const path = require("path");
const APP_DIR = path.resolve(__dirname, "..");
const APP_NAME = path.basename(APP_DIR);

function leerEnv(clave, porDefecto) {
  try {
    const m = fs.readFileSync(path.join(APP_DIR, ".env"), "utf8").match(new RegExp(`^${clave}=["']?([^"'
]*)`, "m"));
    return (m && m[1]) || porDefecto;
  } catch {
    return porDefecto;
  }
}

module.exports = {
  apps: [
    {
      name: APP_NAME,
      cwd: APP_DIR,
      script: ".next/standalone/server.js",
      // Carga las variables del .env del proyecto (Node 20.6 o superior)
      node_args: `--env-file=${path.join(APP_DIR, ".env")}`,
      env: {
        NODE_ENV: "production",
        PORT: leerEnv("PORT", "3000"),
        HOSTNAME: "127.0.0.1", // solo accesible a través de Nginx
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "900M",
      restart_delay: 3000,
      time: true,
    },
  ],
};

// PM2 — mantiene RepairTrackQR encendido y lo reinicia solo si se cae o si el servidor reinicia.
//   pm2 start deploy/ecosystem.config.cjs     (primera vez)
//   pm2 reload repairtrack                     (después de actualizar)
//   pm2 logs repairtrack                       (ver errores)
const path = require("path");
const APP_DIR = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "repairtrack",
      cwd: APP_DIR,
      script: ".next/standalone/server.js",
      // Carga las variables del .env del proyecto (Node 20.6 o superior)
      node_args: `--env-file=${path.join(APP_DIR, ".env")}`,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
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

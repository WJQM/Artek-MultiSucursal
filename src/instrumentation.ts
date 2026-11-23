// Next.js llama a register() una vez al arrancar el servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // En desarrollo no corre (para no hacer respaldos ni mandar WhatsApp desde la PC), salvo TAREAS=1
  if (process.env.NODE_ENV !== "production" && process.env.TAREAS !== "1") return;
  const { startScheduler } = await import("./backend/scheduler");
  startScheduler();
}

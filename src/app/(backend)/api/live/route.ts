import { getUserFromToken } from "@/backend/auth";
import { liveBus } from "@/backend/live-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Conexión en tiempo real (Server-Sent Events) para las pantallas del personal.
 * Solo envía el NOMBRE del tipo de dato que cambió (ej. "Branch"); cada pantalla vuelve a pedir
 * sus datos por la API normal, que aplica los permisos y la sucursal de siempre.
 */
export async function GET(request: Request) {
  const user = await getUserFromToken(request, { allowCookie: true });
  if (!user) return new Response("No autorizado", { status: 401 });

  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { cleanup(); }
      };
      const onChange = (topic: string) => send(`event: change\ndata: ${JSON.stringify({ t: topic })}\n\n`);
      liveBus.on("change", onChange);
      // Latido: mantiene viva la conexión a través de Nginx y detecta pestañas cerradas
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        liveBus.off("change", onChange);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", () => cleanup());
      send(`retry: 5000\nevent: ready\ndata: {}\n\n`);
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform: que nada lo comprima ni lo retenga; X-Accel-Buffering: Nginx lo entrega al instante
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

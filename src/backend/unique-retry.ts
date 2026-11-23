import { errOf } from "@/shared/errors";

/**
 * Los códigos consecutivos (OT-12, COT-5, CL-3…) se calculan como MAX+1.
 * Si dos personas crean al mismo tiempo, ambas obtienen el mismo número y la segunda
 * choca con la restricción única (error P2002). Aquí se reintenta con el siguiente número.
 */
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (errOf(e).code !== "P2002") throw e;
      lastError = e;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
    }
  }
  throw lastError;
}

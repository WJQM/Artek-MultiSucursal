// Helper to get stored user/token/branch
/** Usuario con sesión iniciada (lo que se guarda en sessionStorage al entrar) */
export interface SessionUser {
  id: string; name: string; email: string; role: string;
  branchId?: string | null; branchName?: string | null; image?: string | null; phone?: string | null;
}

export function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, user: null };
  const token = sessionStorage.getItem("token");
  const raw = sessionStorage.getItem("user");
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch { user = null; }
  return { token, user };
}

export function getActiveBranchId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("user") || "{}";
    const user = JSON.parse(raw);
    if (user.role === "superadmin") {
      return sessionStorage.getItem("activeBranchId") || null;
    }
    return user.branchId || null;
  } catch {
    return null;
  }
}

export function setActiveBranchId(id: string) {
  sessionStorage.setItem("activeBranchId", id);
}

// Authenticated fetch with auto branch header
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = getStoredAuth();
  const branchId = getActiveBranchId();
  // Los encabezados de quien llama vienen como objeto simple (nunca como Headers ni lista)
  const headers = { ...(options.headers || {}) } as Record<string, string>;
  
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Quien llama puede fijar la sucursal; "" = todas (solo tiene efecto para el superadmin)
  if (!("x-branch-id" in headers) && branchId) headers["x-branch-id"] = branchId;
  if (headers["x-branch-id"] === "") delete headers["x-branch-id"];
  
  // Only set Content-Type for non-FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  // Sesión revocada (contraseña cambiada, cuenta suspendida, "cerrar sesiones"…): volver al login
  if (res.status === 401 && token && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    if (window.location.pathname !== "/") window.location.href = "/?expired=1";
  }
  return res;
}

/** Guarda la sesión recibida del servidor y entra al panel que corresponde al rol. */
export async function completeLogin(data: { token: string; user: SessionUser }, push: (path: string) => void) {
  sessionStorage.setItem("token", data.token);
  sessionStorage.setItem("user", JSON.stringify(data.user));
  if (data.user.role === "superadmin") {
    try {
      const bRes = await fetch("/api/branches", { headers: { Authorization: `Bearer ${data.token}` } });
      const b = await bRes.json();
      if (Array.isArray(b) && b.length > 0) sessionStorage.setItem("activeBranchId", b[0].id);
    } catch {}
    push("/dashboard");
  } else {
    push(data.user.role === "tech" ? "/asignaciones" : "/dashboard");
  }
}

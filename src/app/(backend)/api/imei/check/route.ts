import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, unauthorized, canAccessBranch } from "@/backend/auth";
import { rateLimit } from "@/backend/rate-limit";
import { canWriteLog } from "@/backend/repair-log";
import { checkImei, cleanImei, imeiHistory, imeiKind, imeiReady, recentCheck } from "@/backend/imei";

/**
 * { imei, paid?, repairId? }
 * Siempre (gratis): si el IMEI es válido y si ese equipo ya vino antes al taller.
 * paid: true → consulta pagada (robo/bloqueo). Con repairId se guarda en esa orden.
 */
export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const imei = cleanImei(body.imei);
  const kind = imeiKind(imei);
  const paidAvailable = await imeiReady();
  if (kind === "invalid" || kind === "imei-bad") return NextResponse.json({ kind, paidAvailable, history: [], others: 0 });

  if (!rateLimit(`imei-h:${user.id}`, 120, 60 * 60_000).ok) return NextResponse.json({ error: "Demasiadas consultas, espera un momento" }, { status: 429 });
  const repairId = typeof body.repairId === "string" ? body.repairId : undefined;
  const all = await imeiHistory(imei, repairId);
  const mine = all.filter((r) => canAccessBranch(user, r.branchId));
  const history = mine.map((r) => ({ id: r.id, code: r.code, device: [r.device, r.brand, r.model].filter(Boolean).join(" "), issue: r.issue, status: r.status, createdAt: r.createdAt, branch: r.branch?.name || "", clientName: r.clientName }));

  // Si ya se consultó hace poco (pagado), se muestra sin volver a cobrar
  let check = kind === "imei" ? await recentCheck(imei) : null;
  if (body.paid === true && !(check && !repairId)) {
    if (kind !== "imei") return NextResponse.json({ error: "La consulta de robo/bloqueo es solo para IMEI de 15 dígitos" }, { status: 400 });
    if (!paidAvailable) return NextResponse.json({ error: "La consulta de IMEI no está configurada (Configuración › Tareas automáticas › IMEI)" }, { status: 400 });
    if (!rateLimit(`imei-p:${user.id}`, 20, 24 * 3600_000).ok) return NextResponse.json({ error: "Llegaste al límite de 20 consultas pagadas por día" }, { status: 429 });
    let repair: { id: string; branchId: string; technicianId: string | null; imei: string | null } | null = null;
    if (repairId) {
      repair = await prisma.repair.findUnique({ where: { id: repairId }, select: { id: true, branchId: true, technicianId: true, imei: true } });
      if (!repair || !canWriteLog(user, repair)) return NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 });
    }
    const r = await checkImei(imei);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    check = r.check;
    if (repair) await prisma.repair.update({ where: { id: repair.id }, data: { imei, imeiCheck: JSON.stringify(check), imeiCheckedAt: new Date(check.at) } });
  }
  return NextResponse.json({ kind, paidAvailable, history, others: all.length - mine.length, check });
}

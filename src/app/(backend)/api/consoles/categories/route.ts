import { errMsg } from "@/shared/errors";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";
import { getUserFromToken, getEffectiveBranchId, requireAdmin } from "@/backend/auth";

export async function GET(req: Request) {
  const user = await getUserFromToken(req);
  const branchId = user ? getEffectiveBranchId(req, user) : null;
  try {
    let customCats: string[] = [];

    if (branchId) {
      // Logged in — get branch-specific categories
      const key = `console_cats_${branchId}`;
      const record = await prisma.keyValue.findUnique({ where: { key } });
      if (record?.value) {
        try { customCats = JSON.parse(record.value); } catch {}
      }
    } else {
      // No token (public access) — get ALL category records and merge
      const records = await prisma.keyValue.findMany({
        where: { key: { startsWith: "console_cats_" } }
      });
      const allCats = new Set<string>();
      for (const r of records) {
        try {
          const arr = JSON.parse(r.value);
          if (Array.isArray(arr)) arr.forEach((c: string) => allCats.add(c));
        } catch {}
      }
      customCats = [...allCats].sort();
    }

    return NextResponse.json({ categories: customCats });
  } catch (e) {
    console.error("Get categories error:", errMsg(e));
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: Request) {
  // Solo administradores pueden modificar categorías (antes no pedía sesión)
  const user = await requireAdmin(req);
  if (user instanceof NextResponse) return user;
  const branchId = getEffectiveBranchId(req, user);
  try {
    const body = await req.json();
    const raw = body.categories;
    if (!Array.isArray(raw)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    const categories = [...new Set(raw.filter((c: unknown) => typeof c === "string").map((c: string) => c.trim().substring(0, 60)).filter(Boolean))].slice(0, 200);
    const key = branchId ? `console_cats_${branchId}` : "console_cats_global";
    await prisma.keyValue.upsert({
      where: { key },
      update: { value: JSON.stringify(categories) },
      create: { key, value: JSON.stringify(categories) },
    });
    return NextResponse.json({ ok: true, categories, key });
  } catch (e) {
    console.error("Save categories error:", errMsg(e));
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

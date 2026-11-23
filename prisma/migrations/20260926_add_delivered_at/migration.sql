-- Fecha real de entrega de la OT. Antes los ingresos usaban "updatedAt",
-- que cambia con cualquier edición y movía el dinero a otra fecha.
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Rellenar OTs ya entregadas: última vez que pasaron a "delivered" según el historial…
UPDATE "Repair" r
SET "deliveredAt" = h.last_delivered
FROM (
  SELECT "repairId", MAX("createdAt") AS last_delivered
  FROM "StatusHistory"
  WHERE "toStatus" = 'delivered'
  GROUP BY "repairId"
) h
WHERE r.id = h."repairId" AND r.status = 'delivered' AND r."deliveredAt" IS NULL;

-- …y si no hay historial, la mejor aproximación disponible
UPDATE "Repair" SET "deliveredAt" = "updatedAt"
WHERE status = 'delivered' AND "deliveredAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Repair_branchId_deliveredAt_idx" ON "Repair"("branchId", "deliveredAt");

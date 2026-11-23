-- Bitácora: etapa de la orden al escribir y registro a nombre del técnico
ALTER TABLE "RepairLog" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "RepairLog" ADD COLUMN IF NOT EXISTS "recordedById" TEXT;
ALTER TABLE "RepairLog" ADD COLUMN IF NOT EXISTS "recordedByName" TEXT;

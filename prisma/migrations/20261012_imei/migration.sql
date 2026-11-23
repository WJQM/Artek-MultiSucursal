-- IMEI del celular y resultado de la consulta (robo / bloqueo)
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "imei" TEXT;
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "imeiCheck" TEXT;
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "imeiCheckedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Repair_imei_idx" ON "Repair"("imei");

-- Equipos listos sin recoger: recordatorios enviados
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "remindedAt" TIMESTAMP(3);
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "reminders" INTEGER NOT NULL DEFAULT 0;

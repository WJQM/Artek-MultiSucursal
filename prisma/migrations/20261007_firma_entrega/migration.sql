-- Firma del cliente al entregar el equipo
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "signature" TEXT;
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

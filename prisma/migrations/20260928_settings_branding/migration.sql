-- Datos de la empresa configurables (para instalar el sistema a otra empresa sin tocar código)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "warrantyDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "abandonDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "terms" TEXT;

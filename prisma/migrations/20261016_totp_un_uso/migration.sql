-- Cada código de la app autenticadora sirve una sola vez
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLastStep" INTEGER;

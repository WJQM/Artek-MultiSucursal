-- Ubicación de cada sucursal en el mapa
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Precio opcional para Programas y Videojuegos
ALTER TABLE "Software" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
ALTER TABLE "Videogame" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;

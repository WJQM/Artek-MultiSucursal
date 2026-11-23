-- Repuestos: tipo de producto del inventario
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'product';
-- Lo que ya estaba en la categoría "Repuestos" pasa a la pestaña Repuestos
UPDATE "InventoryItem" SET "kind" = 'part' WHERE "kind" = 'product' AND LOWER(COALESCE("category", '')) LIKE '%repuesto%';

-- Mostrar / ocultar en el portal
ALTER TABLE "Software" ADD COLUMN IF NOT EXISTS "showInPortal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "showInPortal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Videogame" ADD COLUMN IF NOT EXISTS "showInPortal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Console" ADD COLUMN IF NOT EXISTS "showInPortal" BOOLEAN NOT NULL DEFAULT true;

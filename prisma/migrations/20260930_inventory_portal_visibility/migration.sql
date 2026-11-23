-- Productos que no se muestran en el portal público
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "showInPortal" BOOLEAN NOT NULL DEFAULT true;

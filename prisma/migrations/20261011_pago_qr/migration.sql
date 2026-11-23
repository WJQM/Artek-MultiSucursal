-- Pagos con QR: cómo pagó el cliente (efectivo o QR) en entregas y notas de venta
ALTER TABLE "Repair" ADD COLUMN IF NOT EXISTS "paidWith" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "paidWith" TEXT;

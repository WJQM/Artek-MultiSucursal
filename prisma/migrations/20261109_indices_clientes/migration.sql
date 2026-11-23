-- v67: búsquedas de clientes por celular más rápidas (Clientes, Extracto, apartados)
CREATE INDEX IF NOT EXISTS "Repair_clientPhone_idx" ON "Repair" ("clientPhone");
-- Clave normalizada del celular (últimos 8 dígitos), la misma que usa /api/clients
CREATE INDEX IF NOT EXISTS "Repair_phoneKey_idx" ON "Repair" ((RIGHT(REGEXP_REPLACE("clientPhone", '\D', '', 'g'), 8))) WHERE "clientPhone" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Quotation_phoneKey_idx" ON "Quotation" ((RIGHT(REGEXP_REPLACE("clientPhone", '\D', '', 'g'), 8))) WHERE "clientPhone" IS NOT NULL;

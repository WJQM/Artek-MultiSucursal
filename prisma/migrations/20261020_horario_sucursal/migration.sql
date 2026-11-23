-- Horario de atencion de cada sucursal (seguimiento del cliente: "Abierto ahora")
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hours" TEXT;

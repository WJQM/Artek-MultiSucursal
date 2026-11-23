-- Apartados desde el portal: el cliente reserva un producto/equipo/consola por unas horas (24 h por defecto)
CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "extended" INTEGER NOT NULL DEFAULT 0,
    "saleId" TEXT,
    "saleCode" TEXT,
    "cancelledBy" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_code_branchId_key" ON "Reservation"("code", "branchId");
CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "Reservation_itemId_status_idx" ON "Reservation"("itemId", "status");
CREATE INDEX IF NOT EXISTS "Reservation_clientPhone_idx" ON "Reservation"("clientPhone");
-- Un equipo o consola (unidad única) nunca puede tener dos apartados activos a la vez
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_unique_active_unit" ON "Reservation"("kind", "itemId") WHERE "status" = 'active' AND "kind" IN ('equipment', 'console');
DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lista de espera: clientes que piden aviso cuando un producto apartado se libera
CREATE TABLE IF NOT EXISTS "ReservationWait" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "clientName" TEXT,
    "clientPhone" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationWait_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReservationWait_kind_itemId_clientPhone_key" ON "ReservationWait"("kind", "itemId", "clientPhone");
CREATE INDEX IF NOT EXISTS "ReservationWait_itemId_notifiedAt_idx" ON "ReservationWait"("itemId", "notifiedAt");
DO $$ BEGIN
  ALTER TABLE "ReservationWait" ADD CONSTRAINT "ReservationWait_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

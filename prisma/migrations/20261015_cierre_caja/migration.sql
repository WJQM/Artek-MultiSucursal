-- Cierre de caja diario
CREATE TABLE IF NOT EXISTS "CashClosing" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashRepairs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "counted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "denominations" TEXT,
    "leftInCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qrTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qrVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CashClosing_branchId_day_key" ON "CashClosing"("branchId", "day");
CREATE INDEX IF NOT EXISTS "CashClosing_branchId_createdAt_idx" ON "CashClosing"("branchId", "createdAt");

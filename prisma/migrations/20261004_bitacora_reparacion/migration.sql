-- Bitácora de la reparación (hallazgos, avances, informe final con fotos)
CREATE TABLE IF NOT EXISTS "RepairLog" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "images" TEXT,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepairLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RepairLog_repairId_createdAt_idx" ON "RepairLog"("repairId", "createdAt");
CREATE INDEX IF NOT EXISTS "RepairLog_branchId_createdAt_idx" ON "RepairLog"("branchId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "RepairLog" ADD CONSTRAINT "RepairLog_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

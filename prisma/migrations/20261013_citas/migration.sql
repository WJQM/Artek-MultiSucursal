-- Citas reservadas desde el portal
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "issue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "cancelledBy" TEXT,
    "repairId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_code_branchId_key" ON "Appointment"("code", "branchId");
CREATE INDEX IF NOT EXISTS "Appointment_branchId_date_idx" ON "Appointment"("branchId", "date");
CREATE INDEX IF NOT EXISTS "Appointment_clientPhone_idx" ON "Appointment"("clientPhone");
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

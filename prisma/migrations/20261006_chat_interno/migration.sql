-- Chat interno: conversación por orden o general de la sucursal, con fotos y "leído hasta"
ALTER TABLE "Message" ALTER COLUMN "repairId" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "images" TEXT;
CREATE INDEX IF NOT EXISTS "Message_branchId_createdAt_idx" ON "Message"("branchId", "createdAt");
CREATE TABLE IF NOT EXISTS "ChatRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRead_userId_threadKey_key" ON "ChatRead"("userId", "threadKey");

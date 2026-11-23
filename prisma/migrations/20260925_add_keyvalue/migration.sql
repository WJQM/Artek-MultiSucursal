-- La tabla KeyValue existía en schema.prisma pero ninguna migración la creaba.
-- IF NOT EXISTS: seguro en servidores donde ya se creó con "prisma db push".
CREATE TABLE IF NOT EXISTS "KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { notifyChange } from "./live-bus";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const base =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = base;
}

const WRITES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);

/**
 * Cliente con avisos en tiempo real: después de cada escritura exitosa avisa qué tipo de dato cambió,
 * para que las demás pantallas abiertas se actualicen solas (ver src/backend/live-bus.ts y /api/live).
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if (WRITES.has(operation)) notifyChange(model);
        return result;
      },
    },
  },
}) as unknown as PrismaClient;

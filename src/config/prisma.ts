import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const RETRYABLE_CODES = new Set([
  "P1001", // cannot reach database server
  "P1002", // database server timed out
  "P1008", // operations timed out
  "P1013", // invalid database string (transient config propagation)
  "P1017", // server has closed the connection (idle timeout on hosted DBs)
]);

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const base = new PrismaClient();

/**
 * Self-healing client: hosted Postgres (Prisma Postgres / serverless)
 * closes idle connections, surfacing P1017 on the next query.
 * The query never executed in that case, so retrying on a fresh
 * connection is safe. Reads retry twice, writes retry once.
 */
export const prisma =
  globalForPrisma.prisma ??
  base.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
        const maxRetries = READ_OPS.has(operation) ? 2 : 1;
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            const retryable =
              error instanceof Prisma.PrismaClientKnownRequestError &&
              RETRYABLE_CODES.has(error.code);
            if (!retryable || attempt >= maxRetries) throw error;
            console.warn(
              `Prisma ${error.code} on ${operation}, retrying (${attempt + 1}/${maxRetries})...`
            );
            try {
              await base.$disconnect();
            } catch {
              // ignore disconnect errors; next query opens a fresh connection
            }
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        },
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma as unknown as PrismaClient;
}

export async function connectToDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Connected to Postgres successfully via Prisma.");
}

import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client across hot reloads in development. In production each
 * lambda gets its own instance. Data-access modules (Phase 3) import this; UI
 * components never touch Prisma directly.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

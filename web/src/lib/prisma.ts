import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL ?? "";
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (!connectionString.startsWith("postgres")) {
    return new PrismaClient({ log });
  }

  const { PrismaNeon } =
    require("@prisma/adapter-neon") as typeof import("@prisma/adapter-neon");
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter, log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

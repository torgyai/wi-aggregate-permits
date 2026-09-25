import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = databaseUrl();
export const db = globalForPrisma.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

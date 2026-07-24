import { PrismaClient } from '@prisma/client';

const DEFAULT_DB_URL = "postgresql://neondb_owner:npg_cF1QziKohf2G@ep-withered-smoke-ajfxwd31-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || DEFAULT_DB_URL
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

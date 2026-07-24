let prismaClient: any = null;

const DEFAULT_DB_URL = "postgresql://neondb_owner:npg_cF1QziKohf2G@ep-withered-smoke-ajfxwd31-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

try {
  const { PrismaClient } = require('@prisma/client');
  const activeUrl = process.env.DATABASE_URL || DEFAULT_DB_URL;
  process.env.DATABASE_URL = activeUrl;

  const globalForPrisma = global as unknown as { prisma: any };

  prismaClient = globalForPrisma.prisma || new PrismaClient({
    datasourceUrl: activeUrl
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
  }
} catch (e: any) {
  console.warn('[Prisma Dynamic Load Warning]: Could not initialize PrismaClient:', e?.message || e);
}

export const prisma = prismaClient;
export default prisma;

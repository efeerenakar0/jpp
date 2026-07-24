import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_cF1QziKohf2G@ep-withered-smoke-ajfxwd31-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

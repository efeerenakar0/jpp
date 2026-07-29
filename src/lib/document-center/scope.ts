import type { Prisma } from '@prisma/client';

export type DocumentListStatus =
  | 'ALL'
  | 'DRAFT'
  | 'GENERATED'
  | 'ARCHIVED'
  | 'CANCELLED'
  | 'DELETED';

export function buildCompanyDocumentScope(input: {
  companyAccountId: string;
  principalType: 'OWNER' | 'EMPLOYEE';
  query?: string;
  status?: DocumentListStatus;
  category?: string;
  from?: string;
  to?: string;
}): Prisma.CompanyDocumentWhereInput {
  const status = input.status ?? 'ALL';
  const deleted = status === 'DELETED';
  const where: Prisma.CompanyDocumentWhereInput = {
    companyAccountId: input.companyAccountId,
    deletedAt: deleted
      ? { not: null }
      : status === 'ALL' && input.principalType === 'OWNER'
        ? undefined
        : null,
  };

  if (status !== 'ALL' && status !== 'DELETED') {
    where.status = status;
  }
  if (input.category && input.category !== 'ALL') {
    where.template = { category: input.category };
  }
  if (input.query) {
    where.OR = [
      { title: { contains: input.query, mode: 'insensitive' } },
      { documentNumber: { contains: input.query, mode: 'insensitive' } },
      { template: { name: { contains: input.query, mode: 'insensitive' } } },
    ];
  }
  if (input.from || input.to) {
    where.updatedAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
  }

  return where;
}

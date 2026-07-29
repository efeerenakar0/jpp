import { describe, expect, it } from 'vitest';
import { buildCompanyDocumentScope } from './scope';

describe('Belge Merkezi tenant kapsamı', () => {
  it('her sorguya oturum şirketini zorunlu ekler', () => {
    const where = buildCompanyDocumentScope({
      companyAccountId: 'company-a',
      principalType: 'EMPLOYEE',
      query: 'kapora',
      category: 'SALES',
      status: 'GENERATED',
    });

    expect(where.companyAccountId).toBe('company-a');
    expect(where.status).toBe('GENERATED');
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toHaveLength(3);
    expect(where.template).toEqual({ category: 'SALES' });
  });

  it('çalışanın silinen belgeleri ALL sorgusunda görmesini engeller', () => {
    const where = buildCompanyDocumentScope({
      companyAccountId: 'company-a',
      principalType: 'EMPLOYEE',
      status: 'ALL',
    });
    expect(where.deletedAt).toBeNull();
  });

  it('patronun çöp kutusunu açıkça sorgulamasına izin verir', () => {
    const where = buildCompanyDocumentScope({
      companyAccountId: 'company-a',
      principalType: 'OWNER',
      status: 'DELETED',
    });
    expect(where.deletedAt).toEqual({ not: null });
  });

  it('tarih aralığını güvenli Date nesnelerine dönüştürür', () => {
    const where = buildCompanyDocumentScope({
      companyAccountId: 'company-a',
      principalType: 'OWNER',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.000Z',
    });
    expect(where.updatedAt).toEqual({
      gte: new Date('2026-07-01T00:00:00.000Z'),
      lte: new Date('2026-07-31T23:59:59.000Z'),
    });
  });
});

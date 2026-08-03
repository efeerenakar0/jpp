import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadPortfolioVideoCatalog } from './data';

describe('loadPortfolioVideoCatalog tenant authorization', () => {
  it('portföyleri ve medyayı yalnız oturumdaki companyAccountId ile sorgular', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { crmProperty: { findMany } };

    await loadPortfolioVideoCatalog(
      {
        account: {
          id: 'company-a',
          companyName: 'A Şirketi',
          brandLogoData: null,
          ownerName: 'A Patronu',
          ownerPhone: null,
          ownerEmail: null,
        },
        member: null,
        displayName: 'A Patronu',
      },
      client as never
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyAccountId: 'company-a',
          status: { in: ['DRAFT', 'ACTIVE', 'RESERVED'] },
        },
        include: expect.objectContaining({
          media: expect.objectContaining({
            where: expect.objectContaining({
              companyAccountId: 'company-a',
              archivedAt: null,
            }),
          }),
        }),
      })
    );
  });

  it('kısıtlı medyayı istemci DTOsuna sokmaz ve atanmış danışmanı kullanır', async () => {
    const client = {
      crmProperty: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'property-a',
            title: 'Villa',
            referenceCode: 'P-1',
            location: 'Alanya',
            price: 10_000_000,
            roomCount: '4+1',
            area: 240,
            status: 'ACTIVE',
            description: 'Havuzlu, deniz manzaralı, geniş teraslı villa.',
            imageUrl: null,
            assignedMember: {
              name: 'Danışman A',
              phone: '+905551112233',
              email: 'a@example.com',
            },
            media: [
              {
                id: 'allowed',
                url: 'https://cdn.test/allowed.jpg',
                fileName: 'allowed.jpg',
                width: 1200,
                height: 900,
                isCover: true,
                usageRightsStatus: 'CONFIRMED',
              },
              {
                id: 'restricted',
                url: 'https://cdn.test/restricted.jpg',
                fileName: 'restricted.jpg',
                width: 1200,
                height: 900,
                isCover: false,
                usageRightsStatus: 'RESTRICTED',
              },
            ],
          },
        ]),
      },
    };

    const result = await loadPortfolioVideoCatalog(
      {
        account: {
          id: 'company-a',
          companyName: 'A Şirketi',
          brandLogoData: null,
          ownerName: 'Patron',
          ownerPhone: null,
          ownerEmail: null,
        },
        member: null,
        displayName: 'Patron',
      },
      client as never
    );

    expect(result.portfolios[0].photos.map((item) => item.id)).toEqual(['allowed']);
    expect(result.portfolios[0].advisor.name).toBe('Danışman A');
  });
});

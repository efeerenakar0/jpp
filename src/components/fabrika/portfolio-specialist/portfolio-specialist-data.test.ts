import { describe, expect, it } from 'vitest';
import {
  buildPortfolioRows,
  filterPortfolioRows,
  resolveContactPermission,
} from './portfolio-specialist-data';
import type { HuntingListing, WorkspaceProperty } from './types';

function listing(overrides: Partial<HuntingListing> = {}): HuntingListing {
  return {
    id: 'listing-1',
    title: 'Oba 2+1 daire',
    sourceUrl: 'https://example.test/listing-1',
    status: 'YELLOW',
    ...overrides,
  };
}

const property: WorkspaceProperty = {
  id: 'property-1',
  title: 'Oba 2+1 daire',
  referenceCode: 'P-101',
  location: 'Alanya / Oba',
  price: 4_500_000,
  roomCount: '2+1',
  area: 110,
  status: 'ACTIVE',
  imageUrl: null,
  assignedMember: { id: 'member-1', name: 'Efe' },
};

describe('portfolio specialist data', () => {
  it('does not treat an unverified contact as contactable', () => {
    expect(
      resolveContactPermission(
        listing({
          contacts: [
            {
              verificationStatus: 'UNVERIFIED',
              legalBasisStatus: 'UNKNOWN',
              doNotContactAt: null,
              policyDecisions: [],
            },
          ],
        })
      )
    ).toBe('review');
  });

  it('honors do-not-contact even when an older policy allowed contact', () => {
    expect(
      resolveContactPermission(
        listing({
          contacts: [
            {
              verificationStatus: 'VERIFIED',
              legalBasisStatus: 'CONFIRMED',
              doNotContactAt: '2026-08-05T10:00:00.000Z',
              policyDecisions: [
                {
                  allowed: true,
                  reasonCodes: [],
                  evaluatedAt: '2026-08-04T10:00:00.000Z',
                },
              ],
            },
          ],
        })
      )
    ).toBe('denied');
  });

  it('joins tenant workspace properties to imported listings and finds the next task', () => {
    const rows = buildPortfolioRows(
      [
        listing({
          status: 'GREEN',
          portfolioImport: {
            id: 'import-1',
            status: 'APPROVED',
            propertyId: property.id,
            reviewNote: null,
          },
        }),
      ],
      [property],
      [
        {
          id: 'task-late',
          dueAt: '2026-08-08T10:00:00.000Z',
          status: 'OPEN',
          property: { id: property.id, title: property.title },
        },
        {
          id: 'task-first',
          dueAt: '2026-08-06T10:00:00.000Z',
          status: 'OPEN',
          property: { id: property.id, title: property.title },
        },
      ]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.property?.id).toBe(property.id);
    expect(rows[0]?.assignedMember?.name).toBe('Efe');
    expect(rows[0]?.nextActionAt).toBe('2026-08-06T10:00:00.000Z');
    expect(filterPortfolioRows(rows, 'published')).toHaveLength(1);
  });

  it('keeps eliminated discoveries visible without pretending they are CRM properties', () => {
    const rows = buildPortfolioRows(
      [listing({ status: 'RED', title: 'Elenen ilan' })],
      [],
      []
    );
    expect(filterPortfolioRows(rows, 'eliminated')[0]).toMatchObject({
      title: 'Elenen ilan',
      property: null,
    });
  });
});

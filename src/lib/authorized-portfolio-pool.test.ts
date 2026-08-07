import { describe, expect, it } from 'vitest';

import {
  authorizedPoolEligibility,
  sanitizeAuthorizedPoolListing,
} from './authorized-portfolio-pool';

const now = new Date('2026-08-05T12:00:00.000Z');

const eligibleListing = {
  shareStatus: 'ACTIVE' as const,
  sharePermissionGrantedAt: new Date('2026-08-01T12:00:00.000Z'),
  authorityDocumentVerifiedAt: new Date('2026-08-01T12:00:00.000Z'),
  authorityExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
  propertyStatus: 'ACTIVE' as const,
};

describe('authorized portfolio pool rules', () => {
  it('requires explicit sharing permission and a valid sales authority', () => {
    expect(authorizedPoolEligibility(eligibleListing, now)).toEqual({
      eligible: true,
      reason: null,
    });

    expect(
      authorizedPoolEligibility(
        { ...eligibleListing, sharePermissionGrantedAt: null },
        now
      )
    ).toEqual({ eligible: false, reason: 'SHARING_PERMISSION_MISSING' });

    expect(
      authorizedPoolEligibility(
        { ...eligibleListing, authorityExpiresAt: new Date('2026-08-05T11:59:59Z') },
        now
      )
    ).toEqual({ eligible: false, reason: 'AUTHORITY_EXPIRED' });
  });

  it('never exposes sold, archived, paused, expired or revoked listings', () => {
    for (const shareStatus of ['PAUSED', 'EXPIRED', 'REVOKED'] as const) {
      expect(
        authorizedPoolEligibility({ ...eligibleListing, shareStatus }, now).eligible
      ).toBe(false);
    }

    for (const propertyStatus of ['DRAFT', 'SOLD', 'RENTED', 'ARCHIVED'] as const) {
      expect(
        authorizedPoolEligibility({ ...eligibleListing, propertyStatus }, now).eligible
      ).toBe(false);
    }
  });

  it('returns a public business listing without phone, owner document or private notes', () => {
    const result = sanitizeAuthorizedPoolListing({
      id: 'share-1',
      propertyId: 'property-1',
      ownerCompanyId: 'company-owner',
      ownerCompanyName: 'Akar Emlak',
      title: 'Deniz manzaralı 3+1',
      location: 'Alanya / Kestel',
      price: 12_500_000,
      roomCount: '3+1',
      area: 175,
      propertyType: 'Daire',
      imageUrl: 'https://images.example/property.jpg',
      authorityExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
      ownerPhone: '+905551112233',
      ownerDocumentUrl: 'https://private.example/authority.pdf',
      privateNotes: 'Do not leak this',
    });

    expect(result).toMatchObject({
      id: 'share-1',
      propertyId: 'property-1',
      ownerCompanyName: 'Akar Emlak',
      title: 'Deniz manzaralı 3+1',
    });
    expect(result).not.toHaveProperty('ownerPhone');
    expect(result).not.toHaveProperty('ownerDocumentUrl');
    expect(result).not.toHaveProperty('privateNotes');
    expect(result).not.toHaveProperty('ownerCompanyId');
  });
});

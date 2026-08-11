import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizedPoolView } from './AuthorizedPoolClient';
import { EMPTY_POOL_FILTERS, type AuthorizedPoolPayload } from './types';

const noOp = vi.fn();

const payload: AuthorizedPoolPayload = {
  listings: [
    {
      id: 'share-1',
      propertyId: 'property-1',
      ownerCompanyName: 'Güven Emlak',
      title: 'Deniz manzaralı 3+1 daire',
      location: 'Alanya / Oba',
      price: 5_850_000,
      roomCount: '3+1',
      area: 145,
      propertyType: 'Daire',
      imageUrl: null,
      authorityExpiresAt: '2027-08-05T12:00:00.000Z',
      isOwn: false,
      duplicateCount: 0,
      authorizedOfficeCount: 1,
      request: null,
    },
  ],
  management: {
    ownedShares: [],
    incomingRequests: [],
    availableProperties: [],
  },
};

describe('AuthorizedPoolView', () => {
  it('renders only public portfolio fields and the safe contact-request action', () => {
    const html = renderToStaticMarkup(
      <AuthorizedPoolView
        data={payload}
        error={null}
        filters={EMPTY_POOL_FILTERS}
        isOwner={false}
        loading={false}
        onFiltersChange={noOp}
        onOpenDialog={noOp}
        onRefresh={noOp}
        onRequest={noOp}
        onShareStatus={noOp}
      />
    );

    expect(html).toContain('Deniz manzaralı 3+1 daire');
    expect(html).toContain('Güven Emlak');
    expect(html).toContain('İletişim iste');
    expect(html).not.toContain('Telefon');
    expect(html).not.toContain('Belge URL');
  });

  it('does not expose owner management tabs to employees', () => {
    const html = renderToStaticMarkup(
      <AuthorizedPoolView
        data={payload}
        error={null}
        filters={EMPTY_POOL_FILTERS}
        isOwner={false}
        loading={false}
        onFiltersChange={noOp}
        onOpenDialog={noOp}
        onRefresh={noOp}
        onRequest={noOp}
        onShareStatus={noOp}
      />
    );

    expect(html).not.toContain('Paylaşım yönetimi');
    expect(html).not.toContain('Gelen talepler');
  });

  it('provides an accessible retry action when loading fails', () => {
    const html = renderToStaticMarkup(
      <AuthorizedPoolView
        data={null}
        error="Havuz kullanılamıyor."
        filters={EMPTY_POOL_FILTERS}
        isOwner
        loading={false}
        onFiltersChange={noOp}
        onOpenDialog={noOp}
        onRefresh={noOp}
        onRequest={noOp}
        onShareStatus={noOp}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Yeniden dene');
  });

  it('keeps the navigation and active panel stacked at every viewport width', () => {
    const html = renderToStaticMarkup(
      <AuthorizedPoolView
        data={payload}
        error={null}
        filters={EMPTY_POOL_FILTERS}
        isOwner
        loading={false}
        onFiltersChange={noOp}
        onOpenDialog={noOp}
        onRefresh={noOp}
        onRequest={noOp}
        onShareStatus={noOp}
      />
    );

    expect(html).toMatch(/data-slot="tabs"[^>]*class="[^"]*\sflex-col(?:\s|\")/);
    expect(html).toContain('data-pool-navigation="true"');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/fabrika' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('./FabrikaCommandPalette', () => ({
  default: () => null,
}));

vi.mock('./FabrikaJobIndicator', () => ({
  default: () => <span>İş durumu</span>,
}));

vi.mock('./NotificationBell', () => ({
  default: () => <button type="button" aria-label="Bildirimler" />,
}));

import FabrikaTopbar from './FabrikaTopbar';
import type { FabrikaClientSession } from './FabrikaSessionContext';

const baseSession: FabrikaClientSession = {
  principalType: 'OWNER',
  displayName: 'Efe Patron',
  hunterEnabled: true,
  permissions: {
    canManageTeam: true,
    canManageSecrets: true,
    canViewSubscription: true,
    canEditReports: true,
  },
};

function renderTopbar(session: FabrikaClientSession) {
  return renderToStaticMarkup(
    <FabrikaTopbar
      account={{ companyName: 'Örnek Emlak', logoData: null }}
      session={session}
    />
  );
}

describe('FabrikaTopbar role safety and keyboard surface', () => {
  beforeEach(() => {
    mocks.pathname = '/fabrika';
  });

  it('offers labelled topbar controls and owner-only settings to owners', () => {
    const html = renderTopbar(baseSession);

    expect(html).toContain('aria-label="Business CEO AI ana ekran"');
    expect(html).toContain('/business-ceo/homepage-reference-v3.png');
    expect(html).toContain('REAL ESTATE');
    expect(html).not.toContain('Real Estate');
    expect(html).not.toContain('Real Estate Operations');
    expect(html).not.toContain('aria-label="Açık temaya geç"');
    expect(html).not.toContain('aria-label="Koyu temaya geç"');
    expect(html).toContain('aria-label="Modülleri aç"');
    expect(html).toContain('aria-label="Şirket ve hesap menüsü"');
    expect(html).toContain('aria-label="Hesap makinesi ve kur çeviriciyi aç"');
    expect(html).toContain('href="/fabrika/ayarlar"');
  });

  it('uses the shared light-surface logo on inner Fabrika pages', () => {
    mocks.pathname = '/fabrika/avci';

    const html = renderTopbar(baseSession);

    expect(html).toContain('%2Fbusiness-ceo%2Fbusiness-ceo-ai-light-header.png');
    expect(html).toContain('REAL ESTATE');
    expect(html).not.toContain('Real Estate');
  });

  it('does not expose company settings to employees', () => {
    const html = renderTopbar({
      ...baseSession,
      principalType: 'EMPLOYEE',
      displayName: 'Ece Çalışan',
      permissions: {
        canManageTeam: false,
        canManageSecrets: false,
        canViewSubscription: false,
        canEditReports: false,
      },
    });

    expect(html).not.toContain('href="/fabrika/ayarlar"');
    expect(html).toContain('aria-label="Şirket ve hesap menüsü"');
  });
});

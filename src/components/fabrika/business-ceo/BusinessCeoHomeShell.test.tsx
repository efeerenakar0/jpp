import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/fabrika/crm' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/components/fabrika/FabrikaCommandPalette', () => ({
  default: () => null,
}));

vi.mock('@/components/fabrika/NotificationBell', () => ({
  default: () => <button type="button" aria-label="Bildirimler" />,
}));

import BusinessCeoHomeShell from './BusinessCeoHomeShell';

describe('BusinessCeoHomeShell persistent workspace navigation', () => {
  it('keeps dashboard navigation in workspace mode and marks the current page', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoHomeShell
        account={{ companyName: 'Jasmine Group', logoData: null }}
        session={{
          principalType: 'OWNER',
          displayName: 'Patron',
          hunterEnabled: true,
          permissions: {
            canManageTeam: true,
            canManageSecrets: true,
            canViewSubscription: true,
            canEditReports: true,
          },
        }}
      >
        <div>CRM içeriği</div>
      </BusinessCeoHomeShell>
    );

    expect(html).toContain('/fabrika/crm?view=customers&amp;workspace=dashboard');
    expect(html).toContain('/fabrika/portfoyler?workspace=dashboard');
    expect(html).toContain('/fabrika/asistan?workspace=dashboard');
    expect(html).toContain('CRM · Müşteri Takibi');
    expect(html).toContain('Belge ve Sözleşme Asistanı');
    expect(html).toContain('Hesap makinesi ve kur çeviriciyi aç');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-dashboard-workspace="true"');
    expect(html).toContain('CRM içeriği');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  pathname: '/fabrika/crm',
  workspace: 'dashboard',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(
    navigation.workspace ? `workspace=${navigation.workspace}` : ''
  ),
}));

vi.mock('./FabrikaTopbar', () => ({
  default: () => <header>Standart üst alan</header>,
}));

vi.mock('./OnboardingWizard', () => ({
  default: () => null,
}));

vi.mock('./business-ceo/BusinessCeoHomeShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="persistent-workspace">{children}</div>
  ),
}));

import FabrikaAppShell from './FabrikaAppShell';

const session = {
  principalType: 'OWNER' as const,
  displayName: 'Patron',
  hunterEnabled: true,
  permissions: {
    canManageTeam: true,
    canManageSecrets: true,
    canViewSubscription: true,
    canEditReports: true,
  },
};

describe('FabrikaAppShell display modes', () => {
  it('uses the persistent dashboard shell when navigation came from the sidebar', () => {
    const html = renderToStaticMarkup(
      <FabrikaAppShell
        account={{ companyName: 'Jasmine', logoData: null, onboardingComplete: true }}
        session={session}
      >
        <span>Müşteri ekranı</span>
      </FabrikaAppShell>
    );

    expect(html).toContain('data-testid="persistent-workspace"');
    expect(html).toContain('Müşteri ekranı');
    expect(html).not.toContain('Standart üst alan');
  });

  it('keeps specialist modules full screen without the workspace query', () => {
    navigation.pathname = '/fabrika/avci';
    navigation.workspace = '';

    const html = renderToStaticMarkup(
      <FabrikaAppShell
        account={{ companyName: 'Jasmine', logoData: null, onboardingComplete: true }}
        session={session}
      >
        <span>Avcı ekranı</span>
      </FabrikaAppShell>
    );

    expect(html).toContain('Standart üst alan');
    expect(html).toContain('Avcı ekranı');
    expect(html).not.toContain('data-testid="persistent-workspace"');
  });
});

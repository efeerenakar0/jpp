import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const { requireFabrikaOwnerMock } = vi.hoisted(() => ({
  requireFabrikaOwnerMock: vi.fn(async () => ({
    account: { companyName: 'Örnek Emlak' },
  })),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaOwner: requireFabrikaOwnerMock,
}));

import CompanySettingsPage from './page';

describe('/fabrika/ayarlar', () => {
  it('scopes its readable light form theme to the company settings page', async () => {
    const html = renderToStaticMarkup(await CompanySettingsPage());

    expect(html).toContain('id="company-settings-page"');
    expect(html).toContain('data-company-settings-page="true"');
    expect(html).toContain('Şirket Ayarlarınız');
    expect(html).toContain('Business CEO AI');
  });
});

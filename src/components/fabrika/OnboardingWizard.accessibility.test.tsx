import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OnboardingWizard from './OnboardingWizard';

describe('OnboardingWizard accessibility', () => {
  it('exposes the setup description and measurable progress on the settings page', () => {
    const html = renderToStaticMarkup(
      <OnboardingWizard initialCompanyName="Örnek Emlak" mode="page" />
    );

    expect(html).toContain('id="company-setup-title"');
    expect(html).toContain('id="company-setup-description"');
    expect(html).toContain('aria-describedby="company-setup-description"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="7"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-label="Kurulum ilerlemesi"');
  });
});

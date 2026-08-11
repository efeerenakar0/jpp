import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QuickPortfolioWizardLauncher } from './QuickPortfolioWizardLauncher';

describe('QuickPortfolioWizardLauncher', () => {
  it('launches the canonical dashboard workflow for an owned portfolio', () => {
    const html = renderToStaticMarkup(<QuickPortfolioWizardLauncher />);
    expect(html).toContain(
      'href="/fabrika?workflow=portfolio&amp;entry=studio&amp;step=source"'
    );
    expect(html).toContain('Portföy bilgilerini gir');
  });
});

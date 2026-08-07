import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QuickPortfolioWizardLauncher } from './QuickPortfolioWizardLauncher';

describe('QuickPortfolioWizardLauncher', () => {
  it('launches the canonical dashboard workflow in hunter mode', () => {
    const html = renderToStaticMarkup(<QuickPortfolioWizardLauncher />);
    expect(html).toContain(
      'href="/fabrika?workflow=portfolio&amp;entry=hunter&amp;step=source"'
    );
    expect(html).toContain('Hızlı portföy akışını başlat');
  });
});

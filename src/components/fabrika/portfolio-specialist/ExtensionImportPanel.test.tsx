import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ExtensionImportPanel } from './ExtensionImportPanel';

describe('ExtensionImportPanel', () => {
  it('shows the Business CEO AI archive while keeping implementation names out of customer copy', () => {
    const html = renderToStaticMarkup(
      <ExtensionImportPanel isImporting={false} onImport={vi.fn()} />
    );

    expect(html).toContain('href="/downloads/business-ceo-ai-extension.zip"');
    expect(html).toContain('business-ceo-ai-extension');
    expect(html).not.toContain('jasmine-extension');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { defaultCompanySettings } from '@/lib/company-settings';
import { TooltipProvider } from '@/components/ui/tooltip';

import CompanySettingsStep from './CompanySettingsStep';

describe('CompanySettingsStep', () => {
  it('keeps team and WhatsApp management reachable without losing setup progress', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <CompanySettingsStep
          members={[]}
          onChange={vi.fn()}
          step={4}
          value={defaultCompanySettings('Örnek Emlak')}
        />
      </TooltipProvider>
    );

    expect(html).toContain('href="/fabrika/sirket"');
    expect(html).toContain('Patron ve çalışanları yönet');
    expect(html).toContain('href="/fabrika/whatsapp"');
    expect(html).toContain('WhatsApp bağlantılarını yönet');
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html).toContain('Bu kurulum sekmesine geri dönün');
    expect(html).toContain('Henüz ekip üyesi eklenmedi');
  });
});

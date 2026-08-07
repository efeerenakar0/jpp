import { describe, expect, it } from 'vitest';
import {
  DEVELOPER_SITE_OPTIONS,
  getDeveloperSiteOption,
} from '@/lib/developer-site-options';

describe('AI Yazılımcı site seçenekleri', () => {
  it('ücretsiz yeni siteyi ilk ve önerilen seçenek olarak sunar', () => {
    expect(DEVELOPER_SITE_OPTIONS[0]).toMatchObject({
      id: 'new',
      recommended: true,
      title: 'Yeni ücretsiz web sitesi oluştur',
    });
    expect(DEVELOPER_SITE_OPTIONS[1]).toMatchObject({
      id: 'existing',
      recommended: false,
    });
  });

  it('müşteriye alan adı, entegrasyon ve SEO kazanımını açıklar', () => {
    const option = getDeveloperSiteOption('new');
    const customerCopy = `${option.description} ${option.benefits.join(' ')}`;
    const normalizedCopy = customerCopy.toLocaleLowerCase('tr-TR');

    expect(normalizedCopy).toContain('alan ad');
    expect(normalizedCopy).toContain('portföy');
    expect(customerCopy).toContain('SEO');
    expect(normalizedCopy).not.toContain('api anahtar');
    expect(normalizedCopy).not.toContain('secret');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createExecutivePortfolioDraft, executivePortfolioReducer } from '../../../lib/executive-portfolio-workflow';
import { PortfolioWorkflowContent } from './PortfolioWorkflowContent';

const noOp = vi.fn();
const noOpAsync = vi.fn(async () => undefined);

describe('PortfolioWorkflowContent', () => {
  it('offers the three agreed Studio entry choices inside one small popup shell', () => {
    const draft = createExecutivePortfolioDraft();
    const html = renderToStaticMarkup(
      <PortfolioWorkflowContent
        draft={draft}
        entryMode="studio"
        onAction={noOp}
        onFilesSelected={noOpAsync}
        onRetryMedia={noOpAsync}
        onContinue={noOpAsync}
        onClose={noOp}
      />
    );

    expect(html).toContain('Mevcut portföyünü seç');
    expect(html).toContain('Sadece resim düzenlemek istiyorum');
    expect(html).toContain('Yeni bir portföy');
    expect(html).toContain('Adım 1 / 6');
  });

  it('shows upload, background processing, autosave and consistent navigation on portfolio step', () => {
    const draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'choose-source',
      source: 'studio',
    });
    const html = renderToStaticMarkup(
      <PortfolioWorkflowContent
        draft={draft}
        entryMode="studio"
        onAction={noOp}
        onFilesSelected={noOpAsync}
        onRetryMedia={noOpAsync}
        onContinue={noOpAsync}
        onClose={noOp}
      />
    );

    expect(html).toContain('Portföy görselleri ve bilgileri');
    expect(html).toContain('Arka planda işlenir');
    expect(html).toContain('İlan türü');
    expect(html).toContain('Satılık');
    expect(html).toContain('Kiralık');
    expect(html).toContain('checked="" value="SALE"');
    expect(html).toContain('Otomatik kaydedildi');
    expect(html).toContain('Geri');
    expect(html).toContain('Kaydet ve çık');
    expect(html).toContain('Devam et');
    expect(html).toContain('Adım 2 / 6');
  });

  it('fails closed on the result screen and exposes a real summary download', () => {
    const base = createExecutivePortfolioDraft();
    const draft = {
      ...base,
      source: 'studio' as const,
      currentStep: 'results' as const,
      propertyId: 'property-1',
      details: { ...base.details, title: 'Kestel Villa' },
    };
    const html = renderToStaticMarkup(
      <PortfolioWorkflowContent
        draft={draft}
        entryMode="studio"
        onAction={noOp}
        onFilesSelected={noOpAsync}
        onRetryMedia={noOpAsync}
        onContinue={noOpAsync}
        onClose={noOp}
      />
    );

    expect(html).not.toContain('Bütün çıktılar hazır');
    expect(html).toContain('Tamamlanacak işler var');
    expect(html).toContain('download="kestel-villa-');
    expect(html).toContain('data:application/json');
  });
});

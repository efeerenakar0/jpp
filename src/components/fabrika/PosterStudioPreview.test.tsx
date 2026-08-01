import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PosterStudioPreview } from './PosterStudioPreview';

describe('PosterStudioPreview', () => {
  it('shows the generated poster directly in the studio with a download action', () => {
    const html = renderToStaticMarkup(
      <PosterStudioPreview
        name="Kestel villa"
        previewUrl="data:image/jpeg;base64,poster"
        format="post"
        mode="creative"
      />
    );

    expect(html).toContain('Son oluşturulan poster');
    expect(html).toContain('src="data:image/jpeg;base64,poster"');
    expect(html).toContain('Kestel villa');
    expect(html).toContain('Posteri indir');
    expect(html).toContain('TEMSİLİ AI GÖRSELİ');
  });

  it('keeps the story aspect ratio and faithful-photo label', () => {
    const html = renderToStaticMarkup(
      <PosterStudioPreview
        name="Alanya story"
        previewUrl="data:image/jpeg;base64,story"
        format="story"
        mode="faithful"
      />
    );

    expect(html).toContain('aspect-ratio:9 / 16');
    expect(html).toContain('GERÇEK FOTOĞRAFLAR');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { extractWebsiteProfile } from './website-profile';

describe('partner website profile metadata', () => {
  it('prefers sourced organization metadata and resolves relative logos', () => {
    const profile = extractWebsiteProfile(`
      <html>
        <head>
          <meta name="description" content="Uluslararası gayrimenkul danışmanlığı." />
          <link rel="icon" href="/favicon.svg" />
          <script type="application/ld+json">
            {
              "@type": "RealEstateAgent",
              "description": "Konut ve yatırım projelerinde uzman uluslararası emlak ofisi.",
              "logo": "/assets/logo.png",
              "address": {
                "streetAddress": "10 Example Street",
                "addressLocality": "London",
                "addressCountry": "GB"
              }
            }
          </script>
        </head>
      </html>
    `, 'https://example.com/about');

    expect(profile).toEqual({
      about: 'Konut ve yatırım projelerinde uzman uluslararası emlak ofisi.',
      logoUrl: 'https://example.com/assets/logo.png',
      address: '10 Example Street, London, GB',
    });
  });

  it('ignores insecure remote logo URLs', () => {
    const profile = extractWebsiteProfile(
      '<meta property="og:image" content="http://cdn.example.com/logo.png">',
      'https://example.com',
    );
    expect(profile.logoUrl).toBeUndefined();
  });
});

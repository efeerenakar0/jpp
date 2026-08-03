import type { PortfolioPromoVideoProps } from '@/lib/portfolio-video/types';

function fixturePhoto(start: string, end: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><circle cx="820" cy="430" r="240" fill="#ffffff" fill-opacity=".08"/><path d="M120 1320 L540 780 960 1320 V1640 H120Z" fill="#ffffff" fill-opacity=".12"/><text x="540" y="1510" text-anchor="middle" fill="#ffffff" fill-opacity=".72" font-family="Arial" font-size="54">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS: PortfolioPromoVideoProps = {
  storyboard: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 450,
    title: 'Denize Yakın Modern Yaşam',
    referenceCode: 'P-104',
    locationLabel: 'Alanya / Kestel',
    priceLabel: '6.500.000 TL',
    detailLabels: ['3+1 oda', '165 m²', 'Ref: P-104'],
    featureLabels: ['Deniz manzarası', 'Geniş balkon', 'Açık havuz'],
    photoUrls: [
      fixturePhoto('#0b526b', '#071923', 'DIŞ CEPHE'),
      fixturePhoto('#725d3c', '#152a2e', 'YAŞAM ALANI'),
      fixturePhoto('#176a78', '#092135', 'MANZARA'),
    ],
    showPrice: true,
    showLocation: true,
    companyName: 'Jasmine Group',
    companyLogoUrl: null,
    advisorName: 'Efe Eren',
    advisorPhone: '+90 555 111 22 33',
    advisorEmail: 'efe@example.com',
    direction: {
      style: 'CINEMATIC',
      pace: 'SLOW',
      tone: 'ELEGANT',
      effectIntensity: 0.58,
      showPrice: true,
      commandSummary: 'Lüks ve sinematik olsun',
    },
    scenes: [
      { id: 'hook', type: 'HOOK', fromFrame: 0, toFrame: 60, headline: 'Denize Yakın Modern Yaşam', body: 'Yeni yaşamınıza yakından bakın' },
      { id: 'gallery', type: 'GALLERY', fromFrame: 60, toFrame: 210, headline: 'Portföyü keşfedin', body: 'Seçilmiş portföy detayları' },
      { id: 'features', type: 'FEATURES', fromFrame: 210, toFrame: 300, headline: 'Öne çıkan özellikler', body: 'Deniz manzarası · Geniş balkon · Açık havuz' },
      { id: 'details', type: 'DETAILS', fromFrame: 300, toFrame: 375, headline: '6.500.000 TL', body: 'Alanya / Kestel · 3+1 oda · 165 m²' },
      { id: 'contact', type: 'CONTACT', fromFrame: 375, toFrame: 450, headline: 'Detaylı bilgi ve gösterim', body: 'Efe Eren · +90 555 111 22 33 · efe@example.com' },
    ],
  },
};

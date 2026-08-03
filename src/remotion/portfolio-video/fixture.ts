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
    instagramUrl: 'https://instagram.com/jasminegroup',
    direction: {
      style: 'BALANCED',
      pace: 'MEDIUM',
      tone: 'CONFIDENT',
      effectIntensity: 0.72,
      galleryTransition: 'SLIDE',
      photoMotion: 'PAN',
      showPrice: true,
      openingMessage: null,
      closingMessage: 'Ev alma komşu al',
      commandSummary: 'Resimler sıra sıra çıkarken güzel animasyonlar görünsün, en son kısımda “Ev alma komşu al” yazsın',
    },
    planSummary: 'Ana fotoğraf, gecikmeli fiyat, sıralı fotoğraflar ve animasyonlu Instagram kapanışı',
    scenes: [
      {
        id: 'hook', type: 'HOOK', fromFrame: 0, toFrame: 60, headline: 'Denize Yakın Modern Yaşam', body: 'Yeni yaşamınıza yakından bakın',
        photoIndices: [0], layout: 'FULL_BLEED', transition: 'FADE', photoMotion: 'ZOOM',
        overlays: [
          { type: 'BRAND', text: null, animation: 'FADE', position: 'TOP', revealAtFrame: 0 },
          { type: 'TITLE', text: null, animation: 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 8 },
        ],
      },
      {
        id: 'price', type: 'DETAILS', fromFrame: 60, toFrame: 135, headline: 'Fiyat', body: 'Alanya / Kestel',
        photoIndices: [0], layout: 'FULL_BLEED', transition: 'CUT', photoMotion: 'STILL',
        overlays: [
          { type: 'PRICE', text: null, animation: 'POP', position: 'CENTER', revealAtFrame: 18 },
          { type: 'LOCATION', text: null, animation: 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 28 },
        ],
      },
      {
        id: 'gallery', type: 'GALLERY', fromFrame: 135, toFrame: 330, headline: 'Portföyün diğer kareleri', body: 'Seçilmiş portföy detayları',
        photoIndices: [1, 2], layout: 'FRAMED', transition: 'SLIDE', photoMotion: 'PAN',
        overlays: [{ type: 'DESCRIPTION', text: null, animation: 'FADE', position: 'BOTTOM', revealAtFrame: 8 }],
      },
      {
        id: 'contact', type: 'CONTACT', fromFrame: 330, toFrame: 450, headline: 'Instagram’da bizi takip edin', body: 'Efe Eren · +90 555 111 22 33',
        photoIndices: [2], layout: 'CONTACT_CARD', transition: 'SLIDE', photoMotion: 'PAN',
        overlays: [
          { type: 'BRAND', text: null, animation: 'FADE', position: 'TOP', revealAtFrame: 0 },
          { type: 'INSTAGRAM', text: 'https://instagram.com/jasminegroup', animation: 'SLIDE_UP', position: 'CENTER', revealAtFrame: 12 },
          { type: 'CONTACT', text: null, animation: 'POP', position: 'BOTTOM', revealAtFrame: 20 },
        ],
      },
    ],
  },
};

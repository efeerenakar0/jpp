import type { AiVideoPlan } from '@/lib/portfolio-video/ai-video-types';
import type { GeneratedPortfolioVideoFacts } from './GeneratedPortfolioVideo';
import { PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS } from './fixture';

const [cover, interior, view] = PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS.storyboard.photoUrls;

export const GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN: AiVideoPlan = {
  schemaVersion: 1,
  creativeSeed: 8241,
  format: '9:16',
  durationSeconds: 15,
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    background: '#03111d',
    surface: '#0c2636',
    text: '#f4fbff',
    accent: '#28d7f4',
    font: 'MODERN',
  },
  scenes: [
    {
      id: 'hero', helper: 'Hero', startFrame: 0, durationInFrames: 150,
      assetIds: ['cover'], factRefs: ['TITLE'], headline: 'Denize Yakın Modern Yaşam',
      body: 'Kestel’de seçkin bir portföy', motion: 'ZOOM_IN', transition: 'FADE', layout: 'CENTER',
    },
    {
      id: 'details', helper: 'SplitScreen', startFrame: 150, durationInFrames: 150,
      assetIds: ['interior', 'view'], factRefs: ['ROOMS', 'AREA', 'PRICE'], headline: 'Yaşam alanını keşfedin',
      body: null, motion: 'PAN_LEFT', transition: 'SLIDE', layout: 'SPLIT',
    },
    {
      id: 'contact', helper: 'LogoOutro', startFrame: 300, durationInFrames: 150,
      assetIds: ['view'], factRefs: ['LOCATION', 'COMPANY_NAME'], headline: 'Randevunuzu planlayın',
      body: 'Detaylı bilgi için bize ulaşın', motion: 'ZOOM_OUT', transition: 'FADE', layout: 'CENTER',
    },
  ],
};

export const GENERATED_PORTFOLIO_VIDEO_FIXTURE_FACTS: GeneratedPortfolioVideoFacts = {
  title: 'Denize Yakın Modern Yaşam',
  referenceCode: 'P-104',
  location: 'Alanya / Kestel',
  priceLabel: '6.500.000 TL',
  roomCount: '3+1 oda',
  areaLabel: '165 m²',
  features: ['Deniz manzarası', 'Geniş balkon', 'Açık havuz'],
  companyName: 'Business CEO AI Demo',
  companyLogoUrl: null,
  advisorName: 'Demo Danışman',
  advisorPhone: '+90 555 000 00 00',
  assets: [
    { assetId: 'cover', url: cover ?? '' },
    { assetId: 'interior', url: interior ?? '' },
    { assetId: 'view', url: view ?? '' },
  ],
};

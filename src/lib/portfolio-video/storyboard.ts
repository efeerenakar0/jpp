import { z } from 'zod';
import {
  portfolioVideoDirectionSchema,
  portfolioVideoPortfolioSchema,
  portfolioVideoStoryboardSchema,
  type PortfolioVideoDirection,
  type PortfolioVideoPortfolio,
  type PortfolioVideoScene,
  type PortfolioVideoStoryboard,
} from './types';

const storyboardInputSchema = z.object({
  portfolio: portfolioVideoPortfolioSchema,
  direction: portfolioVideoDirectionSchema,
  selectedPhotoIds: z.array(z.string().min(1).max(120)).max(8).optional(),
  showPrice: z.boolean().optional(),
  showLocation: z.boolean().optional(),
});

type StoryboardInput = {
  portfolio: PortfolioVideoPortfolio;
  direction: PortfolioVideoDirection;
  selectedPhotoIds?: string[];
  showPrice?: boolean;
  showLocation?: boolean;
};

function clampText(value: string | null | undefined, maxLength: number, fallback: string) {
  const clean = value?.replace(/\s+/g, ' ').trim() || fallback;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function formatPrice(value: number | null) {
  if (value === null) return null;
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value)} TL`;
}

function orderedPhotoUrls(portfolio: PortfolioVideoPortfolio, selectedPhotoIds?: string[]) {
  const byId = new Map(portfolio.photos.map((photo) => [photo.id, photo]));
  const requested = selectedPhotoIds?.length
    ? selectedPhotoIds.map((id) => byId.get(id)).filter(Boolean)
    : portfolio.photos;
  return [...new Set(requested.map((photo) => photo?.url).filter(Boolean))].slice(0, 8) as string[];
}

function scene(
  id: string,
  type: PortfolioVideoScene['type'],
  fromFrame: number,
  toFrame: number,
  headline: string,
  body: string | null
): PortfolioVideoScene {
  return { id, type, fromFrame, toFrame, headline, body };
}

export function buildPortfolioStoryboard(rawInput: StoryboardInput): PortfolioVideoStoryboard {
  const { portfolio, direction, selectedPhotoIds } = storyboardInputSchema.parse(rawInput);
  const showPrice = rawInput.showPrice ?? direction.showPrice;
  const showLocation = rawInput.showLocation ?? true;
  const title = clampText(portfolio.title, 72, 'Özel portföy');
  const locationLabel = showLocation
    ? clampText(portfolio.location, 100, 'Konum bilgisi için iletişime geçin')
    : 'Özel konum';
  const priceLabel = showPrice ? formatPrice(portfolio.price) : null;
  const detailLabels = [
    portfolio.roomCount ? `${portfolio.roomCount} oda` : null,
    portfolio.area ? `${new Intl.NumberFormat('tr-TR').format(portfolio.area)} m²` : null,
    portfolio.referenceCode ? `Ref: ${portfolio.referenceCode}` : null,
  ].filter(Boolean) as string[];
  const featureLabels = portfolio.features
    .map((feature) => clampText(feature, 90, ''))
    .filter(Boolean)
    .slice(0, 5);
  const photoUrls = orderedPhotoUrls(portfolio, selectedPhotoIds);
  const detailBody = [
    showLocation ? locationLabel : null,
    priceLabel,
    ...detailLabels.slice(0, 2),
  ]
    .filter(Boolean)
    .join(' · ');
  const contactBody = [portfolio.advisor.name, portfolio.advisor.phone, portfolio.advisor.email]
    .filter(Boolean)
    .join(' · ');

  return portfolioVideoStoryboardSchema.parse({
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 450,
    title,
    referenceCode: portfolio.referenceCode,
    locationLabel,
    priceLabel,
    detailLabels,
    featureLabels,
    photoUrls,
    showPrice,
    showLocation,
    companyName: clampText(portfolio.company.name, 120, 'Gayrimenkul danışmanlığı'),
    companyLogoUrl: portfolio.company.logoUrl,
    advisorName: clampText(portfolio.advisor.name, 120, 'Gayrimenkul danışmanı'),
    advisorPhone: portfolio.advisor.phone,
    advisorEmail: portfolio.advisor.email,
    direction,
    scenes: [
      scene('hook', 'HOOK', 0, 60, title, direction.openingMessage ?? (direction.style === 'INVESTMENT' ? 'Değerli bir yatırım fırsatı' : 'Yeni yaşamınıza yakından bakın')),
      scene('gallery', 'GALLERY', 60, 210, 'Portföyü keşfedin', clampText(portfolio.description, 220, 'Seçilmiş portföy detayları')),
      scene('features', 'FEATURES', 210, 300, 'Öne çıkan özellikler', featureLabels.join(' · ') || detailLabels.join(' · ') || 'Detaylar için iletişime geçin'),
      scene('details', 'DETAILS', 300, 375, showPrice && priceLabel ? priceLabel : locationLabel, detailBody || null),
      scene('contact', 'CONTACT', 375, 450, direction.closingMessage ?? 'Bu portföyü yakından görün', contactBody || portfolio.company.name),
    ],
  });
}

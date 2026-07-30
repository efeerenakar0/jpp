'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Download,
  LayoutTemplate,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
import { prepareInstagramShare } from '@/lib/instagram-sharing';
import {
  recommendPropertyMedia,
  togglePosterMediaSelection,
} from '@/lib/property-media-selection';

type PosterFormat = 'post' | 'story';
type PosterMode = 'faithful' | 'creative';

type WorkspaceProperty = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  status: string;
};

type PosterResult = {
  id: string;
  name: string;
  previewUrl: string;
  fingerprint: string;
  brief: PosterForm;
  whatsapp?: string;
  instagram?: string;
  campaignLoading?: boolean;
  saveLoading?: boolean;
  campaignSource?: 'ai' | 'template';
  mediaIds: string[];
  mode: PosterMode;
  savedMediaId?: string;
};

type PortfolioMedia = {
  id: string;
  url: string;
  fileName: string;
  parentMediaId: string | null;
  isCover: boolean;
  sortOrder: number;
  mediaType: 'PHOTO' | 'POSTER' | 'MARKETING_ASSET';
  variantType: 'ORIGINAL' | 'ENHANCED' | 'CREATIVE';
  usageRightsStatus: 'CONFIRMED' | 'UNVERIFIED' | 'RESTRICTED';
  archivedAt: string | null;
  createdAt: string;
};

type PosterForm = {
  companyName: string;
  propertyId: string;
  location: string;
  roomCount: string;
  propertyType: string;
  area: string;
  price: string;
  details: string;
  highlight1: string;
  highlight2: string;
  highlight3: string;
  format: PosterFormat;
  mode: PosterMode;
  posterName: string;
};

const INITIAL_FORM: PosterForm = {
  companyName: '',
  propertyId: '',
  location: '',
  roomCount: '',
  propertyType: '',
  area: '',
  price: '',
  details: '',
  highlight1: '',
  highlight2: '',
  highlight3: '',
  format: 'post',
  mode: 'faithful',
  posterName: '',
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

const POSTER_TEMPLATE_VERSION = 'luxury-editorial-v2';
const POSTER_NAVY = '#06243a';
const POSTER_NAVY_DARK = '#031725';
const POSTER_GOLD = '#e8b85b';
const POSTER_CREAM = '#f6f0e5';

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(
    image,
    x + (width - imageWidth) / 2,
    y + (height - imageHeight) / 2,
    imageWidth,
    imageHeight
  );
  context.restore();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + Math.max(lines.length, 1) * lineHeight;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight = 700,
  family = 'Arial'
) {
  let size = startSize;
  while (size > minSize) {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawRule(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color = 'rgba(232, 184, 91, 0.45)'
) {
  context.fillStyle = color;
  context.fillRect(x, y, width, 1);
}

function drawFeatureList(
  context: CanvasRenderingContext2D,
  items: string[],
  bounds: { x: number; y: number; width: number; height: number },
  columns = 1
) {
  const visibleItems = items.filter(Boolean).slice(0, columns === 1 ? 7 : 6);
  if (!visibleItems.length) return;

  const columnWidth = bounds.width / columns;
  const rows = Math.ceil(visibleItems.length / columns);
  const rowHeight = bounds.height / Math.max(rows, 1);

  visibleItems.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = bounds.x + column * columnWidth;
    const y = bounds.y + row * rowHeight;
    const markerSize = 28;

    context.strokeStyle = POSTER_GOLD;
    context.lineWidth = 2;
    context.strokeRect(x, y + 3, markerSize, markerSize);
    context.fillStyle = POSTER_GOLD;
    context.font = '700 15px Arial';
    context.textAlign = 'center';
    context.fillText(String(index + 1).padStart(2, '0'), x + markerSize / 2, y + 23);
    context.textAlign = 'left';
    context.fillStyle = '#ffffff';
    const fontSize = fitText(context, item, columnWidth - markerSize - 24, 18, 13, 600);
    context.font = `600 ${fontSize}px Arial`;
    drawWrappedText(context, item, x + markerSize + 13, y + 18, columnWidth - markerSize - 24, fontSize + 5, 2);
    drawRule(context, x, y + rowHeight - 8, columnWidth - 14);
  });
}

function drawGallery(
  context: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  bounds: { x: number; y: number; width: number; height: number }
) {
  if (!images.length) {
    context.fillStyle = POSTER_NAVY_DARK;
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return;
  }

  const gap = 4;
  if (images.length <= 3) {
    const cellWidth = (bounds.width - gap * (images.length - 1)) / images.length;
    images.forEach((image, index) => {
      drawImageCover(context, image, bounds.x + index * (cellWidth + gap), bounds.y, cellWidth, bounds.height);
    });
    return;
  }

  const topCount = Math.min(3, images.length);
  const bottomImages = images.slice(topCount);
  const rowHeight = (bounds.height - gap) / 2;
  const topWidth = (bounds.width - gap * (topCount - 1)) / topCount;
  images.slice(0, topCount).forEach((image, index) => {
    drawImageCover(context, image, bounds.x + index * (topWidth + gap), bounds.y, topWidth, rowHeight);
  });
  const bottomWidth = (bounds.width - gap * (bottomImages.length - 1)) / bottomImages.length;
  bottomImages.forEach((image, index) => {
    drawImageCover(
      context,
      image,
      bounds.x + index * (bottomWidth + gap),
      bounds.y + rowHeight + gap,
      bottomWidth,
      rowHeight
    );
  });
}

function drawLogo(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  companyName: string,
  bounds: { x: number; y: number; width: number; height: number }
) {
  if (logo) {
    const ratio = Math.min(bounds.width / logo.width, bounds.height / logo.height);
    const width = logo.width * ratio;
    const height = logo.height * ratio;
    context.drawImage(
      logo,
      bounds.x + (bounds.width - width) / 2,
      bounds.y + (bounds.height - height) / 2,
      width,
      height
    );
    return;
  }

  const name = (companyName || 'GAYRİMENKUL').toLocaleUpperCase('tr-TR');
  const size = fitText(context, name, bounds.width, 27, 16, 700, 'Georgia');
  context.fillStyle = POSTER_GOLD;
  context.font = `700 ${size}px Georgia`;
  context.textAlign = 'center';
  context.fillText(name, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + size / 3);
  context.textAlign = 'left';
}

async function createFinalPoster(input: {
  backgroundUrl: string;
  photoUrls: string[];
  logoUrl: string | null;
  form: PosterForm;
}) {
  const width = 1080;
  const height = input.form.format === 'story' ? 1920 : 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Poster yüzeyi oluşturulamadı.');

  const [background, logo, ...galleryImages] = await Promise.all([
    loadImage(input.backgroundUrl),
    input.logoUrl ? loadImage(input.logoUrl).catch(() => null) : Promise.resolve(null),
    ...input.photoUrls.slice(1, 6).map((url) => loadImage(url).catch(() => null)),
  ]);
  const details = galleryImages.filter((image): image is HTMLImageElement => Boolean(image));
  const title = input.form.posterName.trim() || input.form.propertyType.trim() || 'Özel gayrimenkul fırsatı';
  const company = input.form.companyName.trim() || 'Gayrimenkul';
  const facts = [
    input.form.roomCount ? `${input.form.roomCount} oda` : '',
    input.form.area ? `${input.form.area} m²` : '',
    input.form.propertyType,
  ].filter(Boolean);
  const featureItems = [
    input.form.highlight1,
    input.form.highlight2,
    input.form.highlight3,
    input.form.location,
    input.form.roomCount ? `${input.form.roomCount} oda` : '',
    input.form.area ? `${input.form.area} m² kullanım alanı` : '',
    input.form.propertyType,
  ].filter(Boolean);

  context.fillStyle = POSTER_NAVY_DARK;
  context.fillRect(0, 0, width, height);

  if (input.form.format === 'post') {
    const heroWidth = 748;
    const heroHeight = 705;
    const railWidth = width - heroWidth;
    const galleryY = heroHeight;
    const galleryHeight = 315;
    const footerY = galleryY + galleryHeight;
    const footerHeight = height - footerY;

    drawImageCover(context, background, 0, 0, heroWidth, heroHeight);
    const heroGradient = context.createLinearGradient(0, 0, 0, heroHeight);
    heroGradient.addColorStop(0, 'rgba(3, 23, 37, 0.94)');
    heroGradient.addColorStop(0.43, 'rgba(3, 23, 37, 0.12)');
    heroGradient.addColorStop(1, 'rgba(3, 23, 37, 0.42)');
    context.fillStyle = heroGradient;
    context.fillRect(0, 0, heroWidth, heroHeight);

    context.fillStyle = POSTER_NAVY;
    context.fillRect(heroWidth, 0, railWidth, heroHeight);
    context.fillStyle = POSTER_GOLD;
    context.fillRect(heroWidth, 0, 2, heroHeight);
    context.font = '400 28px Georgia';
    context.fillText('ÖNE ÇIKANLAR', heroWidth + 34, 62);
    drawRule(context, heroWidth + 34, 82, railWidth - 68, POSTER_GOLD);
    drawFeatureList(
      context,
      featureItems,
      { x: heroWidth + 34, y: 112, width: railWidth - 68, height: heroHeight - 138 }
    );

    context.fillStyle = POSTER_GOLD;
    context.font = '700 20px Arial';
    context.fillText(company.toLocaleUpperCase('tr-TR'), 44, 58);
    context.fillStyle = '#ffffff';
    const titleSize = fitText(context, title, heroWidth - 88, 65, 34, 400, 'Georgia');
    context.font = `400 ${titleSize}px Georgia`;
    context.fillText(title, 44, 126);
    drawRule(context, 44, 148, Math.min(230, heroWidth - 88), POSTER_GOLD);

    if (input.form.location) {
      context.fillStyle = POSTER_CREAM;
      context.font = '500 24px Arial';
      context.fillText(`●  ${input.form.location.toLocaleUpperCase('tr-TR')}`, 44, 190);
    }

    facts.slice(0, 3).forEach((fact, index) => {
      const x = 44 + index * 220;
      context.fillStyle = 'rgba(3, 23, 37, 0.8)';
      context.fillRect(x, 222, 196, 74);
      context.strokeStyle = 'rgba(232, 184, 91, 0.75)';
      context.strokeRect(x, 222, 196, 74);
      context.fillStyle = POSTER_GOLD;
      const factSize = fitText(context, fact, 168, 22, 15, 700);
      context.font = `700 ${factSize}px Arial`;
      context.textAlign = 'center';
      context.fillText(fact.toLocaleUpperCase('tr-TR'), x + 98, 266);
      context.textAlign = 'left';
    });

    if (input.form.details) {
      context.fillStyle = 'rgba(3, 23, 37, 0.82)';
      context.fillRect(44, heroHeight - 118, heroWidth - 88, 82);
      context.fillStyle = POSTER_CREAM;
      context.font = '500 18px Arial';
      drawWrappedText(context, input.form.details, 62, heroHeight - 82, heroWidth - 124, 24, 2);
    }

    drawGallery(context, details.length ? details : [background], {
      x: 0,
      y: galleryY,
      width,
      height: galleryHeight,
    });

    context.fillStyle = POSTER_NAVY;
    context.fillRect(0, footerY, width, footerHeight);
    context.fillStyle = POSTER_GOLD;
    context.fillRect(0, footerY, width, 3);
    context.strokeStyle = POSTER_GOLD;
    context.lineWidth = 2;
    context.strokeRect(34, footerY + 34, 350, 142);
    context.fillStyle = POSTER_GOLD;
    context.font = '500 22px Arial';
    context.fillText('FİYAT', 58, footerY + 69);
    const price = input.form.price || 'BİLGİ İÇİN ARAYIN';
    const priceSize = fitText(context, price, 302, 45, 23, 700);
    context.font = `700 ${priceSize}px Arial`;
    context.fillText(price, 58, footerY + 129);

    context.fillStyle = POSTER_CREAM;
    context.font = '700 25px Arial';
    context.textAlign = 'center';
    context.fillText('DETAY VE RANDEVU İÇİN', 570, footerY + 76);
    context.fillStyle = POSTER_GOLD;
    context.font = 'italic 26px Georgia';
    context.fillText('Bizimle iletişime geçin', 570, footerY + 119);
    context.textAlign = 'left';
    drawLogo(context, logo, company, { x: 760, y: footerY + 34, width: 276, height: 132 });

    context.fillStyle = POSTER_CREAM;
    context.fillRect(0, footerY + 200, width, footerHeight - 200);
    const stripItems = [
      input.form.location,
      input.form.roomCount ? `${input.form.roomCount} ODA` : '',
      input.form.area ? `${input.form.area} m²` : '',
      input.form.propertyType,
    ].filter(Boolean).slice(0, 4);
    const stripWidth = width / Math.max(stripItems.length, 1);
    stripItems.forEach((item, index) => {
      const x = index * stripWidth;
      if (index > 0) {
        context.fillStyle = 'rgba(6, 36, 58, 0.2)';
        context.fillRect(x, footerY + 217, 1, footerHeight - 234);
      }
      context.fillStyle = POSTER_NAVY;
      const stripSize = fitText(context, item.toLocaleUpperCase('tr-TR'), stripWidth - 28, 17, 12, 700);
      context.font = `700 ${stripSize}px Arial`;
      context.textAlign = 'center';
      context.fillText(item.toLocaleUpperCase('tr-TR'), x + stripWidth / 2, footerY + 252);
    });
    context.textAlign = 'left';
  } else {
    const heroHeight = 860;
    const featuresY = heroHeight;
    const featuresHeight = 290;
    const galleryY = featuresY + featuresHeight;
    const galleryHeight = 430;
    const footerY = galleryY + galleryHeight;

    drawImageCover(context, background, 0, 0, width, heroHeight);
    const heroGradient = context.createLinearGradient(0, 0, 0, heroHeight);
    heroGradient.addColorStop(0, 'rgba(3, 23, 37, 0.94)');
    heroGradient.addColorStop(0.42, 'rgba(3, 23, 37, 0.08)');
    heroGradient.addColorStop(1, 'rgba(3, 23, 37, 0.74)');
    context.fillStyle = heroGradient;
    context.fillRect(0, 0, width, heroHeight);

    context.fillStyle = POSTER_GOLD;
    context.font = '700 24px Arial';
    context.fillText(company.toLocaleUpperCase('tr-TR'), 56, 72);
    context.fillStyle = '#ffffff';
    const titleSize = fitText(context, title, width - 112, 78, 42, 400, 'Georgia');
    context.font = `400 ${titleSize}px Georgia`;
    context.fillText(title, 56, 156);
    drawRule(context, 56, 182, 280, POSTER_GOLD);
    if (input.form.location) {
      context.fillStyle = POSTER_CREAM;
      context.font = '500 28px Arial';
      context.fillText(`●  ${input.form.location.toLocaleUpperCase('tr-TR')}`, 56, 228);
    }

    const factWidth = (width - 112 - 28 * (facts.length - 1)) / Math.max(facts.length, 1);
    facts.slice(0, 3).forEach((fact, index) => {
      const x = 56 + index * (factWidth + 28);
      context.fillStyle = 'rgba(3, 23, 37, 0.82)';
      context.fillRect(x, heroHeight - 142, factWidth, 86);
      context.strokeStyle = 'rgba(232, 184, 91, 0.75)';
      context.strokeRect(x, heroHeight - 142, factWidth, 86);
      context.fillStyle = POSTER_GOLD;
      const factSize = fitText(context, fact, factWidth - 24, 25, 16, 700);
      context.font = `700 ${factSize}px Arial`;
      context.textAlign = 'center';
      context.fillText(fact.toLocaleUpperCase('tr-TR'), x + factWidth / 2, heroHeight - 89);
    });
    context.textAlign = 'left';

    context.fillStyle = POSTER_NAVY;
    context.fillRect(0, featuresY, width, featuresHeight);
    context.fillStyle = POSTER_GOLD;
    context.fillRect(0, featuresY, width, 3);
    context.font = '400 27px Georgia';
    context.fillText('ÖNE ÇIKAN ÖZELLİKLER', 56, featuresY + 49);
    drawFeatureList(context, featureItems, {
      x: 56,
      y: featuresY + 76,
      width: width - 112,
      height: featuresHeight - 90,
    }, 2);

    drawGallery(context, details.length ? details : [background], {
      x: 0,
      y: galleryY,
      width,
      height: galleryHeight,
    });

    context.fillStyle = POSTER_NAVY;
    context.fillRect(0, footerY, width, height - footerY);
    context.fillStyle = POSTER_GOLD;
    context.fillRect(0, footerY, width, 3);
    context.strokeStyle = POSTER_GOLD;
    context.strokeRect(48, footerY + 42, 430, 174);
    context.fillStyle = POSTER_GOLD;
    context.font = '500 24px Arial';
    context.fillText('FİYAT', 76, footerY + 82);
    const price = input.form.price || 'BİLGİ İÇİN ARAYIN';
    const priceSize = fitText(context, price, 374, 52, 27, 700);
    context.font = `700 ${priceSize}px Arial`;
    context.fillText(price, 76, footerY + 151);
    context.fillStyle = POSTER_CREAM;
    context.font = '700 27px Arial';
    context.textAlign = 'center';
    context.fillText('DETAY VE RANDEVU İÇİN', 758, footerY + 74);
    context.fillStyle = POSTER_GOLD;
    context.font = 'italic 30px Georgia';
    context.fillText('Bizimle iletişime geçin', 758, footerY + 122);
    drawLogo(context, logo, company, { x: 586, y: footerY + 147, width: 344, height: 92 });
    context.textAlign = 'left';
  }

  const modeLabel = input.form.mode === 'creative' ? 'TEMSİLİ AI GÖRSELİ' : 'GERÇEK PORTFÖY FOTOĞRAFLARI';
  context.fillStyle = input.form.mode === 'creative' ? 'rgba(92, 48, 8, 0.94)' : 'rgba(3, 23, 37, 0.9)';
  context.fillRect(20, height - 33, 280, 25);
  context.fillStyle = input.form.mode === 'creative' ? '#fde68a' : '#dbeafe';
  context.font = '700 13px Arial';
  context.fillText(modeLabel, 31, height - 15);

  return canvas.toDataURL('image/jpeg', 0.94);
}

export default function PosterMaker() {
  const { permissions } = useFabrikaSession();
  const [form, setForm] = useState<PosterForm>(INITIAL_FORM);
  const [photos, setPhotos] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(null);
  const [rememberLogo, setRememberLogo] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState<PosterResult[]>([]);
  const [heroKey, setHeroKey] = useState('');
  const [portfolioMedia, setPortfolioMedia] = useState<PortfolioMedia[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [workspaceProperties, setWorkspaceProperties] = useState<WorkspaceProperty[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos]
  );
  const selectedPosterSources = useMemo(() => {
    const mediaSources = selectedMediaIds
      .map((id) => portfolioMedia.find((item) => item.id === id))
      .filter((item): item is PortfolioMedia => Boolean(item))
      .map((item) => ({
        key: `media:${item.id}`,
        url: item.url,
        mediaId: item.id,
        file: null as File | null,
        name: item.fileName,
      }));
    const fileSources = photoPreviews.map(({ file, url }, index) => ({
      key: `file:${index}`,
      url,
      mediaId: null as string | null,
      file,
      name: file.name,
    }));
    const sources = [...mediaSources, ...fileSources].slice(0, 6);
    const hero = sources.find((source) => source.key === heroKey) ?? sources[0];
    return hero
      ? [hero, ...sources.filter((source) => source.key !== hero.key)]
      : sources;
  }, [heroKey, photoPreviews, portfolioMedia, selectedMediaIds]);
  const effectiveHeroKey = selectedPosterSources[0]?.key || '';
  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : savedLogoUrl), [logoFile, savedLogoUrl]);

  useEffect(() => () => photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [photoPreviews]);
  useEffect(() => () => { if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview); }, [logoFile, logoPreview]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/fabrika/studio/poster', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok) {
          setForm((current) => ({ ...current, companyName: data.companyName || current.companyName }));
          setSavedLogoUrl(data.logoDataUrl || null);
          setWorkspaceProperties(data.properties || []);
        }
      } catch {
        // The form stays usable; only the automatic company identity fill is unavailable.
      }
    })();
  }, []);

  const update = <Key extends keyof PosterForm>(key: Key, value: PosterForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectProperty = async (propertyId: string, requestedIds: string[] = []) => {
    const property = workspaceProperties.find((item) => item.id === propertyId);
    if (!property) {
      update('propertyId', '');
      setPortfolioMedia([]);
      setSelectedMediaIds([]);
      return;
    }
    setForm((current) => ({
      ...current,
      propertyId,
      posterName: property.title || current.posterName,
      location: property.location || current.location,
      roomCount: property.roomCount || current.roomCount,
      area: property.area ? String(property.area) : current.area,
      price: property.price ? `${new Intl.NumberFormat('tr-TR').format(property.price)} TL` : current.price,
      details: property.description || current.details,
    }));
    setIsLoadingMedia(true);
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Portföy görselleri yüklenemedi.');
      }
      const items = (data.items || []) as PortfolioMedia[];
      setPortfolioMedia(items);
      const requested = requestedIds.filter((id) =>
        items.some((item) => item.id === id)
      );
      const recommended = recommendPropertyMedia(items, {
        mode: form.mode,
      });
      const selected = (requested.length ? requested : recommended).slice(
        0,
        Math.max(0, 6 - photos.length)
      );
      setSelectedMediaIds(selected);
      const cover = items.find(
        (item) => item.isCover && selected.includes(item.id)
      );
      setHeroKey(`media:${cover?.id || selected[0] || ''}`);
      toast.success(
        `Portföy bilgileri ve ${items.length} medya adayı yüklendi.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Portföy görselleri yüklenemedi.'
      );
    } finally {
      setIsLoadingMedia(false);
    }
  };

  useEffect(() => {
    if (!workspaceProperties.length || form.propertyId) return;
    const search = new URLSearchParams(window.location.search);
    const propertyId = search.get('propertyId');
    if (!propertyId) return;
    const requested = (search.get('mediaIds') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const timer = window.setTimeout(
      () => void selectProperty(propertyId, requested),
      0
    );
    return () => window.clearTimeout(timer);
    // Query hydration intentionally runs when the property catalog first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceProperties]);

  const addPhotos = (incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith('image/'));
    if (incoming.length !== images.length) toast.error('Yalnızca görsel dosyaları ekleyebilirsiniz.');
    setPhotos((current) => {
      const keys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...images.filter((file) => !keys.has(`${file.name}-${file.size}-${file.lastModified}`))].slice(0, Math.max(0, 6 - selectedMediaIds.length));
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (heroKey === `file:${index}`) setHeroKey('');
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    addPhotos(Array.from(event.target.files || []));
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addPhotos(Array.from(event.dataTransfer.files));
  };

  const createPoster = async () => {
    if (!selectedPosterSources.length) {
      toast.error('Portföyden veya bilgisayarınızdan en az bir görsel seçin.');
      return;
    }
    const fingerprint = JSON.stringify({
      template: POSTER_TEMPLATE_VERSION,
      form,
      heroKey: selectedPosterSources[0]?.key,
      sources: selectedPosterSources.map((source) =>
        source.mediaId
          ? `media:${source.mediaId}`
          : `${source.file?.name}-${source.file?.size}-${source.file?.lastModified}`
      ),
    });
    if (results.some((result) => result.fingerprint === fingerprint)) {
      toast.error('Bu ayarlarla bir poster zaten oluşturuldu. Yeni varyasyon için ana görseli veya bilgileri değiştirin.');
      return;
    }
    setIsCreating(true);
    try {
      const data = new FormData();
      selectedPosterSources
        .filter((source) => source.file)
        .forEach((source) => data.append('photos', source.file!));
      data.append(
        'mediaIdsJson',
        JSON.stringify(
          selectedPosterSources
            .map((source) => source.mediaId)
            .filter((id): id is string => Boolean(id))
        )
      );
      data.append(
        'sourceOrderJson',
        JSON.stringify(selectedPosterSources.map((source) => source.key))
      );
      data.append('heroKey', selectedPosterSources[0]?.key || '');
      if (logoFile) data.append('logo', logoFile);
      data.append('companyName', form.companyName);
      data.append('propertyId', form.propertyId);
      data.append('location', form.location);
      data.append('roomCount', form.roomCount);
      data.append('propertyType', form.propertyType);
      data.append('area', form.area);
      data.append('price', form.price);
      data.append('details', form.details);
      data.append('highlight1', form.highlight1);
      data.append('highlight2', form.highlight2);
      data.append('highlight3', form.highlight3);
      data.append('format', form.format);
      data.append('mode', form.mode);
      data.append('rememberLogo', String(rememberLogo && permissions.canManageSecrets));
      const response = await fetch('/api/fabrika/studio/poster', { method: 'POST', body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Poster üretilemedi.');
      const previewUrl = await createFinalPoster({
        backgroundUrl: body.backgroundDataUrl,
        photoUrls: selectedPosterSources.map((item) => item.url),
        logoUrl: body.logoDataUrl || logoPreview,
        form,
      });
      const name = form.posterName.trim() || `Portföy posteri ${results.length + 1}`;
      setResults((current) => [{
        id: crypto.randomUUID(),
        name,
        previewUrl,
        fingerprint,
        brief: { ...form },
        mediaIds: selectedPosterSources
          .map((source) => source.mediaId)
          .filter((id): id is string => Boolean(id)),
        mode: form.mode,
      }, ...current]);
      if (body.logoDataUrl) setSavedLogoUrl(body.logoDataUrl);
      toast.success('Posteriniz hazır. Şimdi buna özel kampanya metinleri üretebilirsiniz.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Poster üretilemedi.');
    } finally {
      setIsCreating(false);
    }
  };

  const createCampaign = async (id: string) => {
    const result = results.find((item) => item.id === id);
    if (!result) return;
    setResults((current) => current.map((item) => item.id === id ? { ...item, campaignLoading: true } : item));
    try {
      const response = await fetch('/api/fabrika/studio/poster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.brief),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Kampanya metinleri üretilemedi.');
      setResults((current) => current.map((item) => item.id === id ? {
        ...item,
        whatsapp: body.whatsapp,
        instagram: body.instagram,
        campaignSource: body.source,
        campaignLoading: false,
      } : item));
      toast.success('Bu postere özel WhatsApp ve Instagram metinleri hazır.');
    } catch (error) {
      setResults((current) => current.map((item) => item.id === id ? { ...item, campaignLoading: false } : item));
      toast.error(error instanceof Error ? error.message : 'Kampanya metinleri üretilemedi.');
    }
  };

  const savePosterToProperty = async (id: string) => {
    const result = results.find((item) => item.id === id);
    if (!result || !result.brief.propertyId || result.savedMediaId) return;
    setResults((current) =>
      current.map((item) =>
        item.id === id ? { ...item, saveLoading: true } : item
      )
    );
    try {
      const posterResponse = await fetch(result.previewUrl);
      if (!posterResponse.ok) {
        throw new Error('Poster dosyası kaydetmek için hazırlanamadı.');
      }
      const posterBlob = await posterResponse.blob();
      const extension =
        posterBlob.type === 'image/png'
          ? 'png'
          : posterBlob.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const formData = new FormData();
      formData.append(
        'poster',
        new File([posterBlob], `${result.name}.${extension}`, {
          type: posterBlob.type || 'image/jpeg',
        })
      );
      formData.append('propertyId', result.brief.propertyId);
      formData.append('posterName', `${result.name}.${extension}`);
      formData.append('mode', result.mode);
      formData.append('format', result.brief.format);
      formData.append('mediaIdsJson', JSON.stringify(result.mediaIds));
      formData.append('fingerprint', result.fingerprint);
      const response = await fetch('/api/fabrika/studio/poster/save', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error || 'Poster portföye kaydedilemedi.');
      }
      setResults((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                saveLoading: false,
                savedMediaId: body.media.id,
              }
            : item
        )
      );
      toast.success(
        result.mode === 'creative'
          ? 'Poster pazarlama materyallerine kaydedildi.'
          : 'Poster portföy medya kütüphanesine kaydedildi.'
      );
    } catch (error) {
      setResults((current) =>
        current.map((item) =>
          item.id === id ? { ...item, saveLoading: false } : item
        )
      );
      toast.error(
        error instanceof Error ? error.message : 'Poster kaydedilemedi.'
      );
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopyalandı.`);
    } catch {
      toast.error('Kopyalama başarısız oldu. Metni seçip manuel kopyalayabilirsiniz.');
    }
  };

  const shareOnInstagram = async (result: PosterResult) => {
    const outcome = await prepareInstagramShare(
      {
        caption: result.instagram || '',
        posterName: result.name,
        posterUrl: result.previewUrl,
      },
      {
        openInstagram: (url) => {
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        downloadPoster: (url, filename) => {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
        },
        copyCaption: (caption) => navigator.clipboard.writeText(caption),
      },
    );

    if (outcome.captionCopied) {
      toast.success('Poster indirildi, açıklama kopyalandı ve Instagram açıldı. Yeni gönderi oluşturup posteri seçin.');
    } else {
      toast.error('Poster indirildi ve Instagram açıldı; açıklama otomatik kopyalanamadı.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><LayoutTemplate className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold text-white">Gayrimenkul reklam posteri</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">Yapay zekâ görselinizi reklam estetiğine taşır; şirket kimliği ve tüm ilan bilgileri poster üzerinde net biçimde yer alır.</p>
            </div>
          </div>

          <label className="mt-6 block rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-xs font-bold text-emerald-100">Portföyden otomatik doldur <span className="font-normal text-emerald-200/70">(isteğe bağlı)</span>
            <select value={form.propertyId} onChange={(event) => void selectProperty(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400">
              <option value="">Manuel bilgi gireceğim</option>
              {workspaceProperties.map((property) => <option key={property.id} value={property.id}>{property.title}{property.location ? ` · ${property.location}` : ''}</option>)}
            </select>
          </label>

          <fieldset className="mt-5">
            <legend className="text-xs font-bold text-slate-300">Poster modu</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => update('mode', 'faithful')} aria-pressed={form.mode === 'faithful'} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${form.mode === 'faithful' ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-700 bg-slate-950 hover:border-slate-600'}`}><span className="block text-sm font-bold text-white">Gerçek fotoğraflı profesyonel poster</span><span className="mt-1 block text-xs leading-5 text-slate-400">Mülkün fotoğrafları aynen korunur; başlık, özellikler, galeri, fiyat ve şirket kimliği profesyonel broşür şablonuna yerleştirilir.</span></button>
              <button type="button" onClick={() => update('mode', 'creative')} aria-pressed={form.mode === 'creative'} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${form.mode === 'creative' ? 'border-amber-400/70 bg-amber-400/10' : 'border-slate-700 bg-slate-950 hover:border-slate-600'}`}><span className="block text-sm font-bold text-white">Kreatif AI görselli poster</span><span className="mt-1 block text-xs leading-5 text-slate-400">Aynı profesyonel broşür tasarımı kullanılır; yalnızca seçtiğiniz ana fotoğraf Stable Image Ultra ile belirgin biçimde yeniden yorumlanır.</span></button>
            </div>
            {form.mode === 'creative' && <p role="status" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">Bu görsel AI ile yeniden yorumlanır ve <strong>temsilîdir</strong>. İlanın gerçek fotoğrafı veya teknik özelliği olarak kullanılmamalıdır.</p>}
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-bold text-slate-300">Şirket adı <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Şirket adınız" />
            </label>
            <label className="text-xs font-bold text-slate-300">Poster adı <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.posterName} onChange={(event) => update('posterName', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. Kestel deniz manzaralı villa" />
            </label>
            <label className="text-xs font-bold text-slate-300">Konum <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.location} onChange={(event) => update('location', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. Alanya / Kestel" />
            </label>
            <label className="text-xs font-bold text-slate-300">Portföy tipi <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.propertyType} onChange={(event) => update('propertyType', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. Satılık villa" />
            </label>
            <label className="text-xs font-bold text-slate-300">Oda sayısı <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.roomCount} onChange={(event) => update('roomCount', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. 4+1" />
            </label>
            <label className="text-xs font-bold text-slate-300">Metrekare <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.area} onChange={(event) => update('area', event.target.value)} inputMode="numeric" className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. 185" />
            </label>
            <label className="text-xs font-bold text-slate-300">Fiyat <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.price} onChange={(event) => update('price', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. 12.500.000 TL" />
            </label>
          </div>

          <label className="mt-4 block text-xs font-bold text-slate-300">Ek bilgiler <span className="font-normal text-slate-500">(isteğe bağlı)</span>
            <textarea value={form.details} onChange={(event) => update('details', event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Konum, oda sayısı, manzara, teslim durumu veya posterde öne çıkarmak istediğiniz özellikler..." />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['highlight1', 'highlight2', 'highlight3'] as const).map((field, index) => <label key={field} className="text-xs font-bold text-slate-300">Öne çıkan özellik {index + 1} <span className="font-normal text-slate-500">(isteğe bağlı)</span><input value={form[field]} onChange={(event) => update(field, event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder={['Denize yakın', 'Özel havuz', 'Yeni teslim'][index]} /></label>)}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <fieldset>
              <legend className="text-xs font-bold text-slate-300">Tasarım boyutu</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['post', 'Post · 4:5'], ['story', 'Story · 9:16']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => update('format', value)} aria-pressed={form.format === value} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${form.format === value ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'}`}>{label}</button>
                ))}
              </div>
            </fieldset>
            <div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
              <button type="button" onClick={() => logoInputRef.current?.click()} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-600 sm:w-auto"><Building2 className="h-4 w-4 text-emerald-300" /> {logoPreview ? 'Logoyu değiştir' : 'Şirket logosu ekle'}</button>
              {logoPreview && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  {/* Local object URLs and saved tenant logos intentionally use native preview rendering. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview}
                    alt="Şirket logosu ön izlemesi"
                    className="h-5 w-8 rounded bg-white object-contain p-0.5"
                  />
                  Logo hazır
                  {permissions.canManageSecrets && (
                    <label className="ml-1 inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={rememberLogo}
                        onChange={(event) =>
                          setRememberLogo(event.target.checked)
                        }
                        className="accent-emerald-400"
                      />
                      Profilde hatırla
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          {form.propertyId && (
            <section className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-cyan-100">
                    Portföy medya adayları
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    Tüm görseller görünür; posterde en fazla 6 seçili görsel
                    kullanılır. Kapak varsayılan ana görseldir.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200">
                  {selectedPosterSources.length}/6
                </span>
              </div>
              {isLoadingMedia ? (
                <div className="grid h-28 place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
                </div>
              ) : portfolioMedia.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {portfolioMedia.map((item) => {
                    const selected = selectedMediaIds.includes(item.id);
                    const unavailable =
                      item.mediaType !== 'PHOTO' ||
                      item.usageRightsStatus === 'RESTRICTED' ||
                      (form.mode === 'faithful' &&
                        item.variantType === 'CREATIVE');
                    const limitReached =
                      !selected &&
                      selectedMediaIds.length + photos.length >= 6;
                    return (
                      <article
                        className={`group relative aspect-[4/3] overflow-hidden rounded-lg border ${
                          selected
                            ? 'border-cyan-300 ring-2 ring-cyan-300/25'
                            : 'border-slate-700'
                        } ${unavailable ? 'opacity-45' : ''}`}
                        key={item.id}
                      >
                        <button
                          aria-label={`${item.fileName} görselini ${selected ? 'çıkar' : 'seç'}`}
                          aria-pressed={selected}
                          className="h-full w-full disabled:cursor-not-allowed"
                          disabled={unavailable || limitReached}
                          onClick={() => {
                            const next = togglePosterMediaSelection(
                              selectedMediaIds,
                              item.id
                            ).slice(0, Math.max(0, 6 - photos.length));
                            setSelectedMediaIds(next);
                            if (!next.includes(item.id) && heroKey === `media:${item.id}`) {
                              setHeroKey('');
                            }
                          }}
                          type="button"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={item.fileName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            src={item.url}
                          />
                          <span
                            className={`absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border ${
                              selected
                                ? 'border-cyan-100 bg-cyan-300 text-cyan-950'
                                : 'border-white/40 bg-slate-950/75 text-transparent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1.5 pt-5 text-left text-[9px] font-bold text-white">
                            {item.isCover ? 'Kapak · ' : ''}
                            {item.variantType === 'ENHANCED'
                              ? 'İyileştirilmiş'
                              : item.variantType === 'CREATIVE'
                                ? 'Temsilî'
                                : 'Orijinal'}
                          </span>
                        </button>
                        {selected && (
                          <button
                            className={`absolute bottom-1.5 right-1.5 rounded px-1.5 py-1 text-[9px] font-bold ${
                              effectiveHeroKey === `media:${item.id}`
                                ? 'bg-amber-300 text-amber-950'
                                : 'bg-slate-950/85 text-white hover:bg-amber-300 hover:text-amber-950'
                            }`}
                            onClick={() => setHeroKey(`media:${item.id}`)}
                            type="button"
                          >
                            {effectiveHeroKey === `media:${item.id}`
                              ? 'ANA'
                              : 'Ana yap'}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">
                  Bu portföyde medya yok. Aşağıdan manuel görsel ekleyebilirsiniz.
                </p>
              )}
            </section>
          )}
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={onPhotoChange} />
          <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && photoInputRef.current?.click()} onClick={() => photoInputRef.current?.click()} className="grid min-h-56 cursor-pointer place-items-center rounded-xl border border-dashed border-emerald-400/40 bg-emerald-400/[0.05] p-6 text-center transition hover:bg-emerald-400/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-300 text-emerald-950"><UploadCloud className="h-6 w-6" /></span><p className="mt-4 text-sm font-bold text-white">Gayrimenkul görsellerini yükleyin</p><p className="mt-1 text-xs leading-5 text-slate-400">Bir veya birden çok görsel bırakın ya da seçmek için tıklayın. En fazla 6 görsel.</p></div>
          </div>
          {photoPreviews.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold text-slate-300">
                Manuel görseller · ana görseli seçin
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photoPreviews.map(({ file, url }, index) => {
                  const key = `file:${index}`;
                  return (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className={`group relative aspect-[4/3] overflow-hidden rounded-lg border ${
                        heroKey === key
                          ? 'border-amber-300 ring-2 ring-amber-300/40'
                          : 'border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setHeroKey(key)}
                        className="h-full w-full"
                        aria-pressed={heroKey === key}
                        aria-label={`${file.name} ana görsel olarak seç`}
                      >
                        {/* Native img is required for local object URL previews. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                        {heroKey === key && (
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-amber-300 px-1.5 py-1 text-[10px] font-bold text-amber-950">
                            ANA GÖRSEL
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removePhoto(index);
                        }}
                        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-slate-950/80 text-white transition hover:bg-rose-500"
                        aria-label={`${file.name} görselini kaldır`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">{form.mode === 'faithful' ? 'Gerçek fotoğraflı modda seçtiğiniz ana görsel ve galeri fotoğrafları değiştirilmeden profesyonel şablona yerleştirilir.' : 'Kreatif modda yalnızca seçtiğiniz ana görsel Stable Image Ultra ile yeniden yorumlanır; diğer gerçek fotoğraflar galeri bölümünde aynen korunur.'} Görselleriniz yalnızca poster üretimi için sunucuda işlenir.</p>
          <button type="button" onClick={createPoster} disabled={isCreating || !selectedPosterSources.length} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${form.mode === 'creative' ? 'bg-amber-300 text-amber-950 hover:bg-amber-200' : 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'}`}>{isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {isCreating ? 'Poster hazırlanıyor…' : form.mode === 'creative' ? 'Kreatif AI posteri oluştur' : 'Gerçeğe sadık poster oluştur'}</button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-white">
                Oluşturulan posterler
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Her postere özel kampanya metni üretin ve sonucu seçili
                portföyün medya kütüphanesine kaydedin.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              <Check className="h-3.5 w-3.5" /> {results.length} hazır
            </span>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <article
                key={result.id}
                className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.previewUrl}
                    alt={result.name}
                    className="w-full object-cover"
                    style={{
                      aspectRatio:
                        result.brief.format === 'story' ? '9 / 16' : '4 / 5',
                    }}
                  />
                  {result.brief.mode === 'creative' ? (
                    <span className="absolute left-3 top-3 rounded-full border border-amber-200/30 bg-amber-950/90 px-2 py-1 text-[10px] font-bold text-amber-100">
                      TEMSİLİ AI GÖRSELİ
                    </span>
                  ) : (
                    <span className="absolute left-3 top-3 rounded-full border border-sky-200/20 bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-sky-100">
                      GERÇEK FOTOĞRAFLAR
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">
                      {result.name}
                    </h3>
                    <a
                      href={result.previewUrl}
                      download={`${result.name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '_') || 'jasmine_poster'}.jpg`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      aria-label="Posteri indir"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                  {result.brief.propertyId && (
                    <button
                      type="button"
                      onClick={() => savePosterToProperty(result.id)}
                      disabled={result.saveLoading || Boolean(result.savedMediaId)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-emerald-400/25 disabled:bg-emerald-400/10 disabled:text-emerald-200"
                    >
                      {result.saveLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {result.savedMediaId
                        ? 'Portföye kaydedildi'
                        : result.mode === 'creative'
                          ? 'Pazarlama materyallerine kaydet'
                          : 'Portföye poster olarak kaydet'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => createCampaign(result.id)}
                    disabled={result.campaignLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                  >
                    {result.campaignLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}{' '}
                    AI ile reklam kampanyası oluştur
                  </button>
                  {result.whatsapp && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          mesajı
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            copy(result.whatsapp || '', 'WhatsApp mesajı')
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white"
                        >
                          <Copy className="h-3 w-3" /> Kopyala
                        </button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                        {result.whatsapp}
                      </p>
                    </div>
                  )}
                  {result.instagram && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-200">
                          <Share2 className="h-3.5 w-3.5" /> Instagram
                          açıklaması
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            copy(result.instagram || '', 'Instagram açıklaması')
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white"
                        >
                          <Copy className="h-3 w-3" /> Kopyala
                        </button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                        {result.instagram}
                      </p>
                      <button
                        type="button"
                        onClick={() => shareOnInstagram(result)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-pink-200 hover:text-pink-100"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Instagram için hazırla
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

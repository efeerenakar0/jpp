'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  Building2,
  Check,
  ChevronRight,
  CircleCheckBig,
  Copy,
  Download,
  Eye,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { siFacebook, siInstagram, siWhatsapp } from 'simple-icons';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
import {
  AUTO_BANNERBEAR_PRESET_ID,
  bannerbearPresetsForFormat,
  findBannerbearPreset,
} from '@/lib/bannerbear-poster-catalog';
import { prepareInstagramShare } from '@/lib/instagram-sharing';
import { recommendPropertyMedia } from '@/lib/property-media-selection';
import styles from './PosterMaker.module.css';

type PosterFormat = 'post' | 'story';
type PosterOutputSize = 'square' | 'portrait' | 'wide';
type PosterMode = 'creative';
type VideoTransition = 'none' | 'fade' | 'dissolve' | 'wipeleft' | 'slideleft';
type PosterPlatformId =
  | 'instagram-post'
  | 'instagram-story'
  | 'facebook'
  | 'whatsapp'
  | 'linkedin';

type PosterContentOptions = {
  price: boolean;
  location: boolean;
  propertyFacts: boolean;
  logo: boolean;
  contact: boolean;
  description: boolean;
};

type WorkspaceProperty = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  propertyType: string | null;
  area: number | null;
  listingType: string;
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
  generationId: string;
  regenerationCount: number;
  maxRegenerations: number;
  remainingRegenerations: number;
  savedMediaId?: string;
  contentOptions: PosterContentOptions;
  platforms: PosterPlatformId[];
  requiresTextReview: boolean;
  providerCostUsd: number | null;
};

type PosterApiResponse = {
  success?: boolean;
  error?: string;
  code?: string;
  alreadyCompleted?: boolean;
  posterUrl?: string;
  posterDataUrl?: string;
  backgroundDataUrl?: string;
  logoDataUrl?: string;
  requiresTextReview?: boolean;
  providerCostUsd?: number | null;
  templateUid?: string;
  templateName?: string;
  presetId?: string;
  presetName?: string;
  generation?: {
    id: string;
    regenerationCount: number;
    maxRegenerations: number;
    remainingRegenerations: number;
  };
};

type PosterVideoResult = {
  jobId: string;
  videoUrl: string;
  durationSeconds: number;
  photoCount: number;
};

type PosterVideoApiResponse = Partial<PosterVideoResult> & {
  success?: boolean;
  error?: string;
  pending?: boolean;
  progress?: number;
};

type PosterVideoJobResponse = {
  job?: {
    id: string;
    status: 'QUEUED' | 'SUBMITTING' | 'GENERATING' | 'PERSISTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
    progress: number;
    durationSeconds: number;
    referenceMediaIds: string[];
    artifactHref: string | null;
    errorMessage: string | null;
  };
  error?: string;
};

type PosterQueueItem = {
  id: string;
  label: string;
  status: 'PROCESSING' | 'FAILED';
  error?: string;
};

type PosterHistoryPhoto = {
  id: string;
  name: string;
  url: string;
  format: PosterFormat;
  createdAt: string;
  byteSize: number | null;
};

type PosterHistoryVideo = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  ratio: string;
  createdAt: string;
  byteSize: number | null;
};

type PosterHistoryFolder = {
  id: string;
  propertyId: string | null;
  name: string;
  location: string | null;
  latestAt: string;
  photos: PosterHistoryPhoto[];
  videos: PosterHistoryVideo[];
};

type PosterHistoryResponse = {
  folders?: PosterHistoryFolder[];
  totals?: { photos: number; videos: number };
  error?: string;
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
  outputSize: PosterOutputSize;
  presetId: string;
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
  outputSize: 'square',
  presetId: AUTO_BANNERBEAR_PRESET_ID,
  mode: 'creative',
  posterName: '',
};

const INITIAL_CONTENT_OPTIONS: PosterContentOptions = {
  price: true,
  location: true,
  propertyFacts: true,
  logo: true,
  contact: true,
  description: true,
};

const POSTER_ROTATION_STORAGE_KEY = 'business-ceo-ai-poster-layout-bag-v2';
const VIDEO_JOB_STORAGE_KEY = 'business-ceo-ai-poster-video-job';

type PosterRotationBag = Partial<Record<PosterFormat, { last: string | null; remaining: string[] }>>;

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const swapIndex = values[0] % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Uses every real layout once before opening a new shuffled cycle. */
function takeRandomPreset(format: PosterFormat, avoidPresetId?: string | null) {
  const presets = bannerbearPresetsForFormat(format);
  if (!presets.length) throw new Error('Bu boyut için Bannerbear şablonu bulunamadı.');
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(POSTER_ROTATION_STORAGE_KEY) || '{}'
    ) as PosterRotationBag;
    const last = avoidPresetId || stored[format]?.last || null;
    const validIds = new Set(presets.map((preset) => preset.id));
    let remaining = (stored[format]?.remaining || []).filter(
      (id) => validIds.has(id) && id !== last
    );
    if (!remaining.length) {
      remaining = shuffled(presets.map((preset) => preset.id).filter((id) => id !== last));
      if (!remaining.length) remaining = [presets[0].id];
    }
    const nextId = remaining.shift()!;
    const next = findBannerbearPreset(nextId) || presets[0];
    window.localStorage.setItem(
      POSTER_ROTATION_STORAGE_KEY,
      JSON.stringify({
        ...stored,
        [format]: { last: next.id, remaining },
      } satisfies PosterRotationBag)
    );
    return next;
  } catch {
    const alternatives = presets.filter((preset) => preset.id !== avoidPresetId);
    return shuffled(alternatives.length ? alternatives : presets)[0];
  }
}

function historyDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function historyFileSize(value: number | null) {
  if (!value || value <= 0) return '';
  if (value < 1_000_000) return `${Math.max(1, Math.round(value / 1_000))} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

const PLATFORM_OPTIONS: Array<{
  id: PosterPlatformId;
  name: string;
  shortName: string;
  tone: 'instagram' | 'facebook' | 'whatsapp' | 'linkedin';
  iconPath: string;
}> = [
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    shortName: 'IG',
    tone: 'instagram',
    iconPath: siInstagram.path,
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    shortName: 'ST',
    tone: 'instagram',
    iconPath: siInstagram.path,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'f',
    tone: 'facebook',
    iconPath: siFacebook.path,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Durum',
    shortName: 'WA',
    tone: 'whatsapp',
    iconPath: siWhatsapp.path,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    shortName: 'in',
    tone: 'linkedin',
    iconPath: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.56 20.452h3.553V9H3.56v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z',
  },
];

const POSTER_SIZE_OPTIONS: Array<{
  id: PosterOutputSize;
  name: string;
  dimensions: string;
  format: PosterFormat;
  shape: 'square' | 'portrait' | 'wide';
}> = [
  { id: 'square', name: 'Kare', dimensions: '1080 × 1080', format: 'post', shape: 'square' },
  { id: 'portrait', name: 'Dikey', dimensions: '1080 × 1350', format: 'story', shape: 'portrait' },
  { id: 'wide', name: 'Yatay banner', dimensions: '1500 × 500', format: 'post', shape: 'wide' },
];

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

const POSTER_TEMPLATE_VERSION = 'bannerbear-v5-real-layouts-contrast-v2';
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

// Eski canvas şablonu geriye dönük karşılaştırma için tutuluyor; yeni akış bunu çağırmaz.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createFinalPoster(input: {
  backgroundUrl: string;
  photoUrls: string[];
  logoUrl: string | null;
  form: PosterForm;
  contentOptions: PosterContentOptions;
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

    if (input.contentOptions.logo) {
      context.fillStyle = POSTER_GOLD;
      context.font = '700 20px Arial';
      context.fillText(company.toLocaleUpperCase('tr-TR'), 44, 58);
    }
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
    if (input.contentOptions.price) {
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
    }

    if (input.contentOptions.contact) {
      context.fillStyle = POSTER_CREAM;
      context.font = '700 25px Arial';
      context.textAlign = 'center';
      context.fillText('DETAY VE RANDEVU İÇİN', 570, footerY + 76);
      context.fillStyle = POSTER_GOLD;
      context.font = 'italic 26px Georgia';
      context.fillText('Bizimle iletişime geçin', 570, footerY + 119);
      context.textAlign = 'left';
    }
    if (input.contentOptions.logo) {
      drawLogo(context, logo, company, { x: 760, y: footerY + 34, width: 276, height: 132 });
    }

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

    if (input.contentOptions.logo) {
      context.fillStyle = POSTER_GOLD;
      context.font = '700 24px Arial';
      context.fillText(company.toLocaleUpperCase('tr-TR'), 56, 72);
    }
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
    if (input.contentOptions.price) {
      context.strokeStyle = POSTER_GOLD;
      context.strokeRect(48, footerY + 42, 430, 174);
      context.fillStyle = POSTER_GOLD;
      context.font = '500 24px Arial';
      context.fillText('FİYAT', 76, footerY + 82);
      const price = input.form.price || 'BİLGİ İÇİN ARAYIN';
      const priceSize = fitText(context, price, 374, 52, 27, 700);
      context.font = `700 ${priceSize}px Arial`;
      context.fillText(price, 76, footerY + 151);
    }
    if (input.contentOptions.contact) {
      context.fillStyle = POSTER_CREAM;
      context.font = '700 27px Arial';
      context.textAlign = 'center';
      context.fillText('DETAY VE RANDEVU İÇİN', 758, footerY + 74);
      context.fillStyle = POSTER_GOLD;
      context.font = 'italic 30px Georgia';
      context.fillText('Bizimle iletişime geçin', 758, footerY + 122);
    }
    if (input.contentOptions.logo) {
      drawLogo(context, logo, company, { x: 586, y: footerY + 147, width: 344, height: 92 });
    }
    context.textAlign = 'left';
  }

  const modeLabel = 'NANO BANANA 2 + DOĞRU METİN';
  context.fillStyle = 'rgba(92, 48, 8, 0.94)';
  context.fillRect(20, height - 33, 280, 25);
  context.fillStyle = '#fde68a';
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
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [results, setResults] = useState<PosterResult[]>([]);
  const [posterQueue, setPosterQueue] = useState<PosterQueueItem[]>([]);
  const [heroKey, setHeroKey] = useState('');
  const [portfolioMedia, setPortfolioMedia] = useState<PortfolioMedia[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [workspaceProperties, setWorkspaceProperties] = useState<WorkspaceProperty[]>([]);
  const [contentOptions, setContentOptions] =
    useState<PosterContentOptions>(INITIAL_CONTENT_OPTIONS);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PosterPlatformId[]>(
    ['instagram-post']
  );
  const [videoTransition, setVideoTransition] = useState<VideoTransition>('fade');
  const [videoSlideDuration, setVideoSlideDuration] = useState(3);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [videoJobId, setVideoJobId] = useState('');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoResult, setVideoResult] = useState<PosterVideoResult | null>(null);
  const [historyFolders, setHistoryFolders] = useState<PosterHistoryFolder[]>([]);
  const [historyTotals, setHistoryTotals] = useState({ photos: 0, videos: 0 });
  const [historyKind, setHistoryKind] = useState<'photos' | 'videos'>('photos');
  const [historyFolderId, setHistoryFolderId] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const posterRequestInFlightRef = useRef(false);

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
  const selectedProperty = useMemo(
    () => workspaceProperties.find((property) => property.id === form.propertyId) ?? null,
    [form.propertyId, workspaceProperties]
  );
  const latestResult = results[0] ?? null;
  const livePreviewUrl = latestResult?.previewUrl ?? selectedPosterSources[0]?.url ?? '';

  const loadHistory = useCallback(async (announce = false) => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch('/api/fabrika/studio/poster/history', {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => null)) as PosterHistoryResponse | null;
      if (!response.ok || !body) {
        throw new Error(body?.error || 'Çalışma geçmişi yüklenemedi.');
      }
      const folders = body.folders || [];
      setHistoryFolders(folders);
      setHistoryTotals(body.totals || { photos: 0, videos: 0 });
      setHistoryFolderId((current) =>
        folders.some((folder) => folder.id === current)
          ? current
          : folders[0]?.id || ''
      );
      if (announce) toast.success('Fotoğraf ve video geçmişi yenilendi.');
    } catch (error) {
      if (announce) {
        toast.error(error instanceof Error ? error.message : 'Çalışma geçmişi yüklenemedi.');
      }
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const visibleHistoryFolders = useMemo(
    () =>
      historyFolders.filter((folder) =>
        historyKind === 'photos' ? folder.photos.length > 0 : folder.videos.length > 0
      ),
    [historyFolders, historyKind]
  );
  const activeHistoryFolder = useMemo(
    () =>
      visibleHistoryFolders.find((folder) => folder.id === historyFolderId) ||
      visibleHistoryFolders[0] ||
      null,
    [historyFolderId, visibleHistoryFolders]
  );

  useEffect(() => () => photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [photoPreviews]);
  useEffect(() => () => { if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview); }, [logoFile, logoPreview]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const rawDraft = window.localStorage.getItem('business-ceo-ai-poster-draft');
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as {
        form?: Partial<PosterForm>;
        contentOptions?: Partial<PosterContentOptions>;
        selectedPlatforms?: PosterPlatformId[];
      };
      timer = window.setTimeout(() => {
        if (draft.form) {
          setForm((current) => ({
            ...current,
            ...draft.form,
            propertyId: '',
            mode: 'creative',
            presetId: AUTO_BANNERBEAR_PRESET_ID,
            outputSize: POSTER_SIZE_OPTIONS.some(
              (option) => option.id === draft.form?.outputSize
            )
              ? draft.form!.outputSize!
              : current.outputSize,
          }));
        }
        if (draft.contentOptions) {
          setContentOptions((current) => ({ ...current, ...draft.contentOptions }));
        }
        if (draft.selectedPlatforms?.length) {
          setSelectedPlatforms(
            draft.selectedPlatforms.filter((id) =>
              PLATFORM_OPTIONS.some((platform) => platform.id === id)
            )
          );
        }
      }, 0);
    } catch {
      window.localStorage.removeItem('business-ceo-ai-poster-draft');
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const storedJobId = window.localStorage.getItem(VIDEO_JOB_STORAGE_KEY) || '';
    if (!storedJobId) return;
    const timer = window.setTimeout(() => {
      setVideoJobId(storedJobId);
      setIsCreatingVideo(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!videoJobId) return;
    let cancelled = false;
    let timer: number | undefined;
    const check = async () => {
      try {
        const response = await fetch(
          `/api/fabrika/studio/video/jobs/${encodeURIComponent(videoJobId)}`,
          { cache: 'no-store' }
        );
        const body = (await response.json().catch(() => null)) as PosterVideoJobResponse | null;
        if (!response.ok || !body?.job) {
          throw new Error(body?.error || 'Video durumu alınamadı.');
        }
        if (cancelled) return;
        setVideoProgress(body.job.progress);
        if (body.job.status === 'COMPLETED' && body.job.artifactHref) {
          setVideoResult({
            jobId: body.job.id,
            videoUrl: body.job.artifactHref,
            durationSeconds: body.job.durationSeconds,
            photoCount: body.job.referenceMediaIds.length,
          });
          setVideoJobId('');
          setIsCreatingVideo(false);
          setVideoProgress(100);
          window.localStorage.removeItem(VIDEO_JOB_STORAGE_KEY);
          toast.success('Portföy videonuz hazır.');
          void loadHistory();
          return;
        }
        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(body.job.status)) {
          setVideoJobId('');
          setIsCreatingVideo(false);
          window.localStorage.removeItem(VIDEO_JOB_STORAGE_KEY);
          toast.error(body.job.errorMessage || 'Portföy videosu tamamlanamadı.');
          return;
        }
        timer = window.setTimeout(check, 2_000);
      } catch (error) {
        if (cancelled) return;
        timer = window.setTimeout(check, 4_000);
        console.warn('[poster-video] status check delayed', error);
      }
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loadHistory, videoJobId]);

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

  const selectOutputSize = (outputSize: PosterOutputSize) => {
    const option = POSTER_SIZE_OPTIONS.find((item) => item.id === outputSize);
    if (!option) return;
    setForm((current) => ({
      ...current,
      outputSize,
      format: option.format,
      presetId: AUTO_BANNERBEAR_PRESET_ID,
    }));
  };

  const toggleContentOption = (key: keyof PosterContentOptions) => {
    setContentOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const togglePlatform = (platformId: PosterPlatformId) => {
    setSelectedPlatforms((current) =>
      current.includes(platformId)
        ? current.filter((item) => item !== platformId)
        : [...current, platformId]
    );
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
      posterName: property.title || '',
      location: property.location || '',
      roomCount: property.roomCount || '',
      propertyType: property.propertyType || '',
      area: property.area != null ? String(property.area) : '',
      price:
        property.price != null
          ? `${new Intl.NumberFormat('tr-TR').format(property.price)} TL`
          : '',
      details: property.description || '',
    }));
    setPhotos([]);
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
      const selected = (requested.length ? requested : recommended).slice(0, 1);
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
    const selectedImages = images.slice(0, 6);
    if (!selectedImages.length) return;
    setSelectedMediaIds([]);
    setPhotos(selectedImages);
    setHeroKey('file:0');
    if (images.length > 6) {
      toast('Poster için ilk 6 fotoğraf eklendi.');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (heroKey === `file:${index}`) setHeroKey('');
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    addPhotos(Array.from(event.target.files || []));
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    addPhotos(Array.from(event.dataTransfer.files));
  };

  const createPoster = async (
    regenerateFrom?: PosterResult,
    formatOverride?: PosterFormat
  ) => {
    if (posterRequestInFlightRef.current) return;
    if (!selectedPosterSources.length) {
      toast.error('Portföyden veya bilgisayarınızdan en az bir görsel seçin.');
      return;
    }
    const activeContentOptions = regenerateFrom?.contentOptions ?? contentOptions;
    const sourceForm = regenerateFrom?.brief ?? form;
    const activeFormat = formatOverride ?? sourceForm.format;
    const automaticStyle = true;
    const resolvedPreset = takeRandomPreset(
      activeFormat,
      regenerateFrom?.brief.presetId || null
    );
    const activeForm: PosterForm = {
      ...sourceForm,
      format: activeFormat,
      presetId: resolvedPreset.id,
      companyName: activeContentOptions.logo ? sourceForm.companyName : '',
      location: activeContentOptions.location ? sourceForm.location : '',
      roomCount: activeContentOptions.propertyFacts ? sourceForm.roomCount : '',
      propertyType: activeContentOptions.propertyFacts ? sourceForm.propertyType : '',
      area: activeContentOptions.propertyFacts ? sourceForm.area : '',
      price: activeContentOptions.price ? sourceForm.price : '',
      details: activeContentOptions.description ? sourceForm.details : '',
      highlight1: activeContentOptions.description ? sourceForm.highlight1 : '',
      highlight2: activeContentOptions.description ? sourceForm.highlight2 : '',
      highlight3: activeContentOptions.description ? sourceForm.highlight3 : '',
    };
    const targetPlatforms = regenerateFrom?.platforms ?? [...selectedPlatforms];
    const fingerprint = JSON.stringify({
      template: POSTER_TEMPLATE_VERSION,
      form: activeForm,
      contentOptions: activeContentOptions,
      platforms: targetPlatforms,
      heroKey: selectedPosterSources[0]?.key,
      sources: selectedPosterSources.map((source) =>
        source.mediaId
          ? `media:${source.mediaId}`
          : `${source.file?.name}-${source.file?.size}-${source.file?.lastModified}`
      ),
    });
    if (
      !regenerateFrom &&
      results.some((result) => result.fingerprint === fingerprint)
    ) {
      toast.error('Bu ayarlarla bir poster zaten oluşturuldu. Yeni varyasyon için ana görseli veya bilgileri değiştirin.');
      return;
    }
    if (regenerateFrom && regenerateFrom.remainingRegenerations <= 0) {
      toast.error('Bu poster için iki yeniden üretim hakkı kullanıldı.');
      return;
    }
    posterRequestInFlightRef.current = true;
    setIsCreating(true);
    const queueId = crypto.randomUUID();
    const sizeName = POSTER_SIZE_OPTIONS.find(
      (option) => option.id === activeForm.outputSize
    )?.name || 'Poster';
    setPosterQueue((current) => [
      {
        id: queueId,
        label: `${activeForm.posterName.trim() || 'Portföy posteri'} · ${sizeName}`,
        status: 'PROCESSING',
      },
      ...current.filter((item) => item.status === 'PROCESSING'),
    ]);
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
      if (logoFile && activeContentOptions.logo) data.append('logo', logoFile);
      data.append('companyName', activeForm.companyName);
      data.append('propertyId', activeForm.propertyId);
      data.append('location', activeForm.location);
      data.append('roomCount', activeForm.roomCount);
      data.append('propertyType', activeForm.propertyType);
      data.append('area', activeForm.area);
      data.append('price', activeForm.price);
      data.append('details', activeForm.details);
      data.append('posterName', activeForm.posterName);
      data.append('highlight1', activeForm.highlight1);
      data.append('highlight2', activeForm.highlight2);
      data.append('highlight3', activeForm.highlight3);
      data.append('format', activeForm.format);
      data.append('outputSize', activeForm.outputSize);
      data.append('presetId', activeForm.presetId);
      data.append(
        'templateUid',
        findBannerbearPreset(activeForm.presetId)?.templateUid || ''
      );
      data.append('mode', activeForm.mode);
      data.append('automaticStyle', String(automaticStyle));
      data.append('showLogo', String(activeContentOptions.logo));
      data.append('showContact', String(activeContentOptions.contact));
      data.append('includePrice', String(activeContentOptions.price));
      data.append('includeLocation', String(activeContentOptions.location));
      data.append(
        'includePropertyFacts',
        String(activeContentOptions.propertyFacts)
      );
      data.append(
        'includeDescription',
        String(activeContentOptions.description)
      );
      data.append(
        'generationAction',
        regenerateFrom ? 'REGENERATE' : 'INITIAL'
      );
      if (regenerateFrom) {
        data.append('generationId', regenerateFrom.generationId);
      }
      data.append('idempotencyKey', crypto.randomUUID());
      data.append(
        'rememberLogo',
        String(
          activeContentOptions.logo &&
            rememberLogo &&
            permissions.canManageSecrets
        )
      );
      const response = await fetch('/api/fabrika/studio/poster', {
        method: 'POST',
        body: data,
      });
      const rawBody = await response.text();
      let body: PosterApiResponse = {};
      try {
        body = rawBody ? (JSON.parse(rawBody) as PosterApiResponse) : {};
      } catch {
        throw new Error(
          response.status === 413
            ? 'Poster hazırlandı fakat sunucunun yanıt sınırına takıldı. Sayfayı yenileyip tekrar açın; aynı işlem ikinci kez ücretlendirilmez.'
            : 'Sunucudan poster sonucu okunamadı. Lütfen birkaç saniye sonra tekrar deneyin.'
        );
      }
      if (!response.ok) {
        throw new Error(body.error || 'Poster üretilemedi.');
      }
      const previewUrl =
        body.posterUrl || body.posterDataUrl || body.backgroundDataUrl || '';
      if (!body.generation?.id) {
        throw new Error('Poster hakkı bilgisi alınamadı. Lütfen yeniden deneyin.');
      }
      if (!previewUrl) {
        throw new Error(
          body.alreadyCompleted
            ? 'Tamamlanan posterin dosyası bulunamadı. Yeni güvenli kayıt için düğmeye yeniden basın.'
            : 'Poster tamamlandı ancak görsel adresi alınamadı. Lütfen tekrar deneyin.'
        );
      }
      const generation = body.generation;
      const actualPreset = body.presetId
        ? findBannerbearPreset(body.presetId)
        : null;
      const resultForm: PosterForm = {
        ...activeForm,
        presetId:
          actualPreset?.format === activeForm.format
            ? actualPreset.id
            : activeForm.presetId,
      };
      const baseName = activeForm.posterName.trim() || `Portföy posteri ${results.length + 1}`;
      const name = `${baseName} · ${sizeName}`;
      setResults((current) => {
        const synchronized = current.map((item) =>
          item.generationId === generation.id
            ? {
                ...item,
                regenerationCount: generation.regenerationCount,
                maxRegenerations: generation.maxRegenerations,
                remainingRegenerations:
                  generation.remainingRegenerations,
              }
            : item
        );
        return [
          {
            id: crypto.randomUUID(),
            name,
            previewUrl,
            fingerprint: `${fingerprint}:${generation.id}:${generation.regenerationCount}`,
            brief: resultForm,
            mediaIds: selectedPosterSources
              .map((source) => source.mediaId)
              .filter((id): id is string => Boolean(id)),
            mode: activeForm.mode,
            generationId: generation.id,
            regenerationCount: generation.regenerationCount,
            maxRegenerations: generation.maxRegenerations,
            remainingRegenerations: generation.remainingRegenerations,
            contentOptions: { ...activeContentOptions },
            platforms: targetPlatforms,
            requiresTextReview: body.requiresTextReview !== false,
            providerCostUsd:
              typeof body.providerCostUsd === 'number'
                ? body.providerCostUsd
                : null,
          },
          ...synchronized,
        ];
      });
      if (body.logoDataUrl) setSavedLogoUrl(body.logoDataUrl);
      setPosterQueue((current) => current.filter((item) => item.id !== queueId));
      toast.success(
        body.alreadyCompleted
          ? 'Daha önce tamamlanan poster açıldı; tekrar ücret alınmadı.'
          : regenerateFrom
          ? `Yeni varyasyon hazır. ${generation.remainingRegenerations} yeniden üretim hakkı kaldı.`
          : 'Posteriniz hazır. En fazla iki kez yeniden üretebilirsiniz.'
      );
      void loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Poster üretilemedi.';
      setPosterQueue((current) =>
        current.map((item) =>
          item.id === queueId
            ? { ...item, status: 'FAILED', error: message }
            : item
        )
      );
      toast.error(message);
    } finally {
      posterRequestInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const createSelectedPosters = async () => {
    if (!selectedPlatforms.length) {
      toast.error('En az bir paylaşım platformu seçin.');
      return;
    }
    setGenerationProgress({ current: 1, total: 1 });
    toast.success('Poster arka plana alındı. Sayfada çalışmaya devam edebilirsiniz.');
    await createPoster(undefined, form.format);
    setGenerationProgress(null);
  };

  const createPortfolioVideo = async () => {
    if (!form.propertyId) {
      toast.error('Video için önce bir portföy seçin.');
      return;
    }
    if (selectedMediaIds.length < 2) {
      toast.error('Video için portföyden en az 2 fotoğraf seçin.');
      return;
    }
    setIsCreatingVideo(true);
    setVideoProgress(8);
    setVideoResult(null);
    try {
      const response = await fetch('/api/fabrika/studio/poster/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: form.propertyId,
          mediaIds: selectedMediaIds.slice(0, 8),
          format: form.format,
          transition: videoTransition,
          slideDuration: videoSlideDuration,
        }),
      });
      const body = (await response.json().catch(() => null)) as PosterVideoApiResponse | null;
      if (!response.ok || !body?.success || !body.jobId) {
        throw new Error(body?.error || 'Portföy videosu hazırlanamadı.');
      }
      setVideoJobId(body.jobId);
      setVideoProgress(body.progress || 8);
      window.localStorage.setItem(VIDEO_JOB_STORAGE_KEY, body.jobId);
      if (body.videoUrl) {
        setVideoResult({
          jobId: body.jobId,
          videoUrl: body.videoUrl,
          durationSeconds: body.durationSeconds || selectedMediaIds.length * videoSlideDuration,
          photoCount: body.photoCount || selectedMediaIds.length,
        });
        setVideoJobId('');
        setIsCreatingVideo(false);
        setVideoProgress(100);
        window.localStorage.removeItem(VIDEO_JOB_STORAGE_KEY);
        toast.success('Portföy videonuz hazır.');
        void loadHistory();
      } else {
        toast.success('Video arka planda hazırlanıyor. Bu sayfada çalışmaya devam edebilirsiniz.');
      }
    } catch (error) {
      setIsCreatingVideo(false);
      setVideoProgress(0);
      toast.error(error instanceof Error ? error.message : 'Portföy videosu hazırlanamadı.');
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

  const saveDraft = () => {
    try {
      window.localStorage.setItem(
        'business-ceo-ai-poster-draft',
        JSON.stringify({
          form: { ...form, propertyId: '' },
          contentOptions,
          selectedPlatforms,
        })
      );
      toast.success('Poster ayarlarınız bu cihazda taslak olarak kaydedildi.');
    } catch {
      toast.error('Taslak bu cihazda kaydedilemedi.');
    }
  };

  return (
    <section className={styles.workshop} aria-labelledby="poster-workshop-title">
      <div className={styles.workspaceGrid}>
        <aside className={styles.stepRail}>
          <header className={styles.workshopIntro}>
            <span className={styles.eyebrow}>
              <WandSparkles aria-hidden="true" />
              AI Reklam Tasarımı
            </span>
            <h1 id="poster-workshop-title">Poster Atölyesi</h1>
            <p>Dört kolay adımı tamamlayın, paylaşmaya hazır posterinizi oluşturun.</p>
          </header>

          <article className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepIcon}><Building2 aria-hidden="true" /></span>
              <span className={styles.stepCopy}>
                <strong>Portföy</strong>
                <small>{selectedProperty ? selectedProperty.title : 'Bir portföy seçin'}</small>
              </span>
              {selectedProperty ? (
                <CircleCheckBig className={styles.stepDone} aria-label="Tamamlandı" />
              ) : (
                <ChevronRight className={styles.stepArrow} aria-hidden="true" />
              )}
            </div>
            <label className={styles.srLabel} htmlFor="poster-property">Reklam portföyü</label>
            <select
              className={styles.propertySelect}
              id="poster-property"
              value={form.propertyId}
              onChange={(event) => void selectProperty(event.target.value)}
            >
              <option value="">Portföyünüzü seçin</option>
              {workspaceProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                  {property.location ? ' · ' + property.location : ''}
                </option>
              ))}
            </select>
            {selectedProperty && (
              <div className={styles.propertySummary}>
                <span>{selectedProperty.location || 'Konum belirtilmemiş'}</span>
                <span className={styles.statusDot}>Aktif</span>
              </div>
            )}
          </article>

          <article className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepIcon}><ImageIcon aria-hidden="true" /></span>
              <span className={styles.stepCopy}>
                <strong>Fotoğraflar</strong>
                <small>{selectedPosterSources.length ? `${selectedMediaIds.length || selectedPosterSources.length} fotoğraf seçildi` : 'Bir ana fotoğraf seçin'}</small>
              </span>
              {selectedPosterSources.length ? (
                <CircleCheckBig className={styles.stepDone} aria-label="Tamamlandı" />
              ) : (
                <ChevronRight className={styles.stepArrow} aria-hidden="true" />
              )}
            </div>

            {isLoadingMedia ? (
              <div className={styles.mediaLoading}>
                <Loader2 aria-hidden="true" />
                Fotoğraflar yükleniyor
              </div>
            ) : portfolioMedia.length ? (
              <div className={styles.mediaPicker} aria-label="Portföy fotoğrafları">
                {portfolioMedia.map((item) => {
                  const selected = selectedMediaIds.includes(item.id);
                  const unavailable =
                    item.mediaType !== 'PHOTO' ||
                    item.usageRightsStatus === 'RESTRICTED' ||
                    item.variantType === 'CREATIVE';
                  return (
                    <div
                      className={[
                        styles.mediaTile,
                        selected ? styles.mediaTileSelected : '',
                        unavailable ? styles.mediaTileUnavailable : '',
                      ].filter(Boolean).join(' ')}
                      key={item.id}
                    >
                      <button
                        aria-label={item.fileName + ' görselini ' + (selected ? 'çıkar' : 'seç')}
                        aria-pressed={selected}
                        disabled={unavailable}
                        onClick={() => {
                          setPhotos([]);
                          setVideoResult(null);
                          setSelectedMediaIds((current) => {
                            if (selected) {
                              const next = current.filter((id) => id !== item.id);
                              if (heroKey === 'media:' + item.id) {
                                setHeroKey(next.length ? 'media:' + next[0] : '');
                              }
                              return next;
                            }
                            if (current.length >= 8) {
                              toast.error('Video için en fazla 8 fotoğraf seçebilirsiniz.');
                              return current;
                            }
                            const next = [...current, item.id];
                            if (!heroKey) setHeroKey('media:' + item.id);
                            return next;
                          });
                        }}
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={item.fileName} loading="lazy" src={item.url} />
                        <span className={styles.mediaCheck}><Check aria-hidden="true" /></span>
                      </button>
                      {selected && (
                        <button
                          className={[
                            styles.heroBadge,
                            effectiveHeroKey === 'media:' + item.id ? styles.heroBadgeActive : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => setHeroKey('media:' + item.id)}
                          type="button"
                        >
                          {effectiveHeroKey === 'media:' + item.id ? 'ANA' : 'Ana yap'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : form.propertyId ? (
              <p className={styles.emptyMedia}>Bu portföyde kullanılabilir fotoğraf bulunamadı.</p>
            ) : (
              <p className={styles.emptyMedia}>Fotoğrafları görmek için önce portföy seçin.</p>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className={styles.hiddenInput}
              onChange={onPhotoChange}
            />
            <button
              type="button"
              className={styles.compactUpload}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              onClick={() => photoInputRef.current?.click()}
            >
              <UploadCloud aria-hidden="true" />
              Bilgisayardan fotoğraf ekle
            </button>

            {photoPreviews.length > 0 && (
              <div className={styles.manualMedia}>
                {photoPreviews.map(({ file, url }, index) => {
                  const key = 'file:' + index;
                  return (
                    <div
                      className={[
                        styles.mediaTile,
                        effectiveHeroKey === key ? styles.mediaTileSelected : '',
                      ].filter(Boolean).join(' ')}
                      key={file.name + '-' + file.lastModified}
                    >
                      <button
                        type="button"
                        onClick={() => setHeroKey(key)}
                        aria-pressed={effectiveHeroKey === key}
                        aria-label={file.name + ' ana görsel olarak seç'}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={file.name} />
                      </button>
                      <button
                        type="button"
                        className={styles.removeMedia}
                        onClick={() => removePhoto(index)}
                        aria-label={file.name + ' görselini kaldır'}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className={[styles.stepCard, styles.stepCardActive].join(' ')}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>3</span>
              <span className={styles.stepIcon}><FileText aria-hidden="true" /></span>
              <span className={styles.stepCopy}>
                <strong>İçerik</strong>
                <small>Başlık, fiyat ve özellikler</small>
              </span>
              <span className={styles.editLabel}>Düzenleniyor</span>
            </div>
          </article>

          <article className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>4</span>
              <span className={styles.stepIcon}><Share2 aria-hidden="true" /></span>
              <span className={styles.stepCopy}>
                <strong>Platformlar</strong>
                <small>{selectedPlatforms.length} platform seçildi</small>
              </span>
              {selectedPlatforms.length ? (
                <CircleCheckBig className={styles.stepDone} aria-label="Tamamlandı" />
              ) : (
                <ChevronRight className={styles.stepArrow} aria-hidden="true" />
              )}
            </div>
            <div className={styles.platformMiniatures}>
              {PLATFORM_OPTIONS.filter((platform) =>
                selectedPlatforms.includes(platform.id)
              ).map((platform) => (
                <span data-tone={platform.tone} key={platform.id}>
                  {platform.shortName}
                </span>
              ))}
            </div>
          </article>
        </aside>

        <main className={styles.previewColumn}>
          <div className={styles.previewToolbar}>
            <div>
              <Eye aria-hidden="true" />
              <span>
                <strong>{latestResult ? 'Son oluşturulan poster' : 'Canlı önizleme'}</strong>
                <small>{latestResult ? 'İndirmeye ve kaydetmeye hazır' : 'Seçimleriniz burada görünür'}</small>
              </span>
            </div>
            <span className={styles.previewSizeBadge}>
              {POSTER_SIZE_OPTIONS.find((option) => option.id === form.outputSize)?.dimensions}
            </span>
          </div>

          <div className={styles.previewStage} data-has-preview={Boolean(livePreviewUrl)}>
            <div
              className={styles.previewCanvas}
              data-size={latestResult?.brief.outputSize ?? form.outputSize}
            >
              {livePreviewUrl ? (
                latestResult ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className={styles.generatedPreview}
                    src={livePreviewUrl}
                    alt={latestResult.name}
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.previewPhoto}
                      src={livePreviewUrl}
                      alt={selectedPosterSources[0]?.name || 'Seçilen portföy fotoğrafı'}
                    />
                    <div className={styles.aiPreviewHint}>
                      <Sparkles aria-hidden="true" />
                      <span>
                        <strong>ANA fotoğraf seçilen şablona yerleştirilecek</strong>
                        <small>Fotoğraf yeniden çizilmez; doğrulanmış portföy bilgileri ayrı alanlara yazılır.</small>
                      </span>
                    </div>
                  </>
                )
              ) : (
                <div className={styles.previewEmpty}>
                  <span><ImageIcon aria-hidden="true" /></span>
                  <strong>Poster önizlemesi için portföy seçin</strong>
                  <p>Portföyünüzün fotoğrafları yüklendiğinde tasarım burada oluşmaya başlar.</p>
                </div>
              )}
            </div>
          </div>

          <div className={styles.previewFooter}>
            <span>
              <SlidersHorizontal aria-hidden="true" />
              Akıllı şablon alanı
            </span>
            <p>Fotoğraf, doğrulanmış bilgiler, logo ve telefonla profesyonel emlak posterine dönüştürülür.</p>
          </div>
        </main>

        <aside className={styles.settingsPanel} id="poster-content-settings">
          <header className={styles.settingsHeader}>
            <div>
              <span>Görsel üzerindeki öğeler</span>
              <strong>Posterde neler yer alsın?</strong>
            </div>
            <SlidersHorizontal aria-hidden="true" />
          </header>

          <div className={styles.optionList}>
            <button type="button" aria-pressed={contentOptions.price} onClick={() => toggleContentOption('price')}>
              <span className={styles.optionIcon}><Tag aria-hidden="true" /></span>
              <span><strong>Fiyatı göster</strong><small>Satış veya kira bedeli</small></span>
              <span className={styles.toggle} data-on={contentOptions.price}><i /></span>
            </button>
            <button type="button" aria-pressed={contentOptions.location} onClick={() => toggleContentOption('location')}>
              <span className={styles.optionIcon}><MapPin aria-hidden="true" /></span>
              <span><strong>Konumu göster</strong><small>İlçe ve bölge bilgisi</small></span>
              <span className={styles.toggle} data-on={contentOptions.location}><i /></span>
            </button>
            <button type="button" aria-pressed={contentOptions.propertyFacts} onClick={() => toggleContentOption('propertyFacts')}>
              <span className={styles.optionIcon}><BedDouble aria-hidden="true" /></span>
              <span><strong>Oda ve m²</strong><small>Temel portföy özellikleri</small></span>
              <span className={styles.toggle} data-on={contentOptions.propertyFacts}><i /></span>
            </button>
            <button type="button" aria-pressed={contentOptions.logo} onClick={() => toggleContentOption('logo')}>
              <span className={styles.optionIcon}><Building2 aria-hidden="true" /></span>
              <span><strong>Şirket logosu</strong><small>Marka kimliğiniz</small></span>
              <span className={styles.toggle} data-on={contentOptions.logo}><i /></span>
            </button>
            <button type="button" aria-pressed={contentOptions.contact} onClick={() => toggleContentOption('contact')}>
              <span className={styles.optionIcon}><Phone aria-hidden="true" /></span>
              <span><strong>İletişim çağrısı</strong><small>Randevu ve bilgi yönlendirmesi</small></span>
              <span className={styles.toggle} data-on={contentOptions.contact}><i /></span>
            </button>
            <button type="button" aria-pressed={contentOptions.description} onClick={() => toggleContentOption('description')}>
              <span className={styles.optionIcon}><FileText aria-hidden="true" /></span>
              <span><strong>Açıklama ve özellikler</strong><small>Özel mesaj ve üç vurgu</small></span>
              <span className={styles.toggle} data-on={contentOptions.description}><i /></span>
            </button>
          </div>

          <div className={styles.automaticStyleNotice}>
            <Sparkles aria-hidden="true" />
            <span>
              <strong>Tasarımı sistem seçer</strong>
              <small>Mevcut {bannerbearPresetsForFormat(form.format).length} gerçek şablon karıştırılır; aynı şablon art arda gelmez.</small>
            </span>
          </div>

          <details className={styles.detailsEditor}>
            <summary>
              <span><FileText aria-hidden="true" /> Metinleri ve tasarım türünü düzenle</span>
              <ChevronRight aria-hidden="true" />
            </summary>
            <div className={styles.editorFields}>
              <label>
                Poster başlığı
                <input
                  value={form.posterName}
                  onChange={(event) => update('posterName', event.target.value)}
                  placeholder="Örn. Hayalinizdeki yaşam"
                />
              </label>
              <div className={styles.twoFields}>
                <label>
                  Fiyat
                  <input
                    value={form.price}
                    onChange={(event) => update('price', event.target.value)}
                    placeholder="12.500.000 TL"
                  />
                </label>
                <label>
                  Konum
                  <input
                    value={form.location}
                    onChange={(event) => update('location', event.target.value)}
                    placeholder="Alanya / Kestel"
                  />
                </label>
              </div>
              <div className={styles.threeFields}>
                <label>
                  Oda
                  <input
                    value={form.roomCount}
                    onChange={(event) => update('roomCount', event.target.value)}
                    placeholder="4+1"
                  />
                </label>
                <label>
                  m²
                  <input
                    inputMode="numeric"
                    value={form.area}
                    onChange={(event) => update('area', event.target.value)}
                    placeholder="185"
                  />
                </label>
                <label>
                  Tür
                  <input
                    value={form.propertyType}
                    onChange={(event) => update('propertyType', event.target.value)}
                    placeholder="Villa"
                  />
                </label>
              </div>
              <label>
                Kısa açıklama
                <textarea
                  value={form.details}
                  onChange={(event) => update('details', event.target.value)}
                  placeholder="Portföyü öne çıkaran kısa ve etkileyici açıklama..."
                />
              </label>
              <div className={styles.threeFields}>
                {(['highlight1', 'highlight2', 'highlight3'] as const).map((field, index) => (
                  <label key={field}>
                    Özellik {index + 1}
                    <input
                      value={form[field]}
                      onChange={(event) => update(field, event.target.value)}
                      placeholder={['Özel havuz', 'Deniz manzarası', 'Yeni teslim'][index]}
                    />
                  </label>
                ))}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={styles.hiddenInput}
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              />
              <button
                type="button"
                className={styles.logoButton}
                onClick={() => logoInputRef.current?.click()}
              >
                <Building2 aria-hidden="true" />
                {logoPreview ? 'Şirket logosunu değiştir' : 'Şirket logosu ekle'}
              </button>
              {logoPreview && (
                <div className={styles.logoStatus}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Şirket logosu önizlemesi" />
                  <span>Logo hazır</span>
                  {permissions.canManageSecrets && (
                    <label>
                      <input
                        type="checkbox"
                        checked={rememberLogo}
                        onChange={(event) => setRememberLogo(event.target.checked)}
                      />
                      Profilde hatırla
                    </label>
                  )}
                </div>
              )}
            </div>
          </details>

          <div className={styles.platformSection}>
            <span className={styles.sectionLabel}>Nerede paylaşacaksınız?</span>
            <div className={styles.platformGrid}>
              {PLATFORM_OPTIONS.map((platform) => {
                const selected = selectedPlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    aria-pressed={selected}
                    className={selected ? styles.platformSelected : undefined}
                    onClick={() => togglePlatform(platform.id)}
                  >
                    <span className={styles.platformLogo} data-tone={platform.tone}>
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d={platform.iconPath} fill="currentColor" /></svg>
                    </span>
                    <strong>{platform.name}</strong>
                    <span className={styles.platformCheck}><Check aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>
            <span className={styles.sectionLabel}>Poster boyutu</span>
            <div className={styles.sizeGrid} role="radiogroup" aria-label="Poster boyutunu seçin">
              {POSTER_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={form.outputSize === option.id}
                  className={form.outputSize === option.id ? styles.sizeSelected : undefined}
                  onClick={() => selectOutputSize(option.id)}
                >
                  <i data-shape={option.shape} aria-hidden="true" />
                  <span><strong>{option.name}</strong><small>{option.dimensions}</small></span>
                  <Check aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <section className={styles.videoComposer} aria-labelledby="portfolio-video-title">
            <header>
              <span className={styles.videoComposerIcon}><Film aria-hidden="true" /></span>
              <span>
                <strong id="portfolio-video-title">Portföy videosu</strong>
                <small>Gerçek fotoğraflarla otomatik MP4</small>
              </span>
              <b>{selectedMediaIds.length}/8</b>
            </header>
            <p>Portföyden 2–8 fotoğraf seçin. Fotoğraflar yeniden çizilmeden sırayla videoya dönüşür.</p>
            <div className={styles.videoControls}>
              <label>
                Geçiş
                <select
                  value={videoTransition}
                  onChange={(event) => setVideoTransition(event.target.value as VideoTransition)}
                >
                  <option value="fade">Yumuşak geçiş</option>
                  <option value="dissolve">Akıcı çözülme</option>
                  <option value="slideleft">Sola kaydır</option>
                  <option value="wipeleft">Perde geçişi</option>
                  <option value="none">Geçişsiz</option>
                </select>
              </label>
              <label>
                Fotoğraf süresi
                <select
                  value={videoSlideDuration}
                  onChange={(event) => setVideoSlideDuration(Number(event.target.value))}
                >
                  <option value={2}>2 saniye</option>
                  <option value={3}>3 saniye</option>
                  <option value={4}>4 saniye</option>
                  <option value={5}>5 saniye</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className={styles.videoGenerateButton}
              disabled={isCreatingVideo || selectedMediaIds.length < 2 || !form.propertyId}
              onClick={() => void createPortfolioVideo()}
            >
              {isCreatingVideo ? <Loader2 className={styles.spin} aria-hidden="true" /> : <Play aria-hidden="true" />}
              {isCreatingVideo ? `Video arka planda hazırlanıyor · %${videoProgress}` : 'Portföy videosu oluştur'}
            </button>
          </section>
        </aside>
      </div>

      <footer className={styles.actionBar}>
        <button type="button" className={styles.draftButton} onClick={saveDraft}>
          <Save aria-hidden="true" />
          Taslağı kaydet
        </button>
        <div className={styles.actionSummary}>
          <span><b>{selectedPosterSources.length}</b> fotoğraf</span>
          <span><b>{selectedPlatforms.length}</b> platform</span>
          <span><b>1</b> akıllı şablon üretimi</span>
        </div>
        <button
          type="button"
          className={styles.generateButton}
          onClick={() => void createSelectedPosters()}
          disabled={isCreating || !selectedPosterSources.length || !selectedPlatforms.length}
        >
          {isCreating ? <Loader2 className={styles.spin} aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {isCreating
            ? generationProgress
              ? `${generationProgress.current}/${generationProgress.total} poster hazırlanıyor…`
              : 'Poster hazırlanıyor…'
            : 'Posteri oluştur'}
          <ChevronRight aria-hidden="true" />
        </button>
      </footer>

      {videoResult && (
        <section className={styles.videoResult} aria-labelledby="video-result-title">
          <div className={styles.videoResultCopy}>
            <span><Film aria-hidden="true" /></span>
            <div>
              <small>Bannerbear video hazır</small>
              <h2 id="video-result-title">Portföyünüz hareketli sunuma dönüştürüldü</h2>
              <p>{videoResult.photoCount} gerçek fotoğraf · {videoResult.durationSeconds} saniye · MP4</p>
            </div>
          </div>
          <video controls playsInline preload="metadata" src={videoResult.videoUrl}>
            Tarayıcınız video oynatmayı desteklemiyor.
          </video>
          <a className={styles.videoDownloadButton} href={videoResult.videoUrl} download>
            <Download aria-hidden="true" /> Videoyu indir
          </a>
        </section>
      )}

      {posterQueue.length > 0 && (
        <section className={styles.backgroundQueue} aria-live="polite">
          <header>
            <span><Loader2 className={styles.spin} aria-hidden="true" /></span>
            <div>
              <strong>Arka plandaki poster işleri</strong>
              <small>Poster hazırlanırken portföy, içerik ve platform seçimlerinizi kullanmaya devam edebilirsiniz.</small>
            </div>
          </header>
          <div>
            {posterQueue.map((item) => (
              <article key={item.id} data-status={item.status}>
                {item.status === 'PROCESSING' ? (
                  <Loader2 className={styles.spin} aria-hidden="true" />
                ) : (
                  <X aria-hidden="true" />
                )}
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.status === 'PROCESSING' ? 'Bannerbear şablonu hazırlanıyor…' : item.error}</small>
                </span>
                {item.status === 'FAILED' && (
                  <button type="button" onClick={() => setPosterQueue((current) => current.filter((entry) => entry.id !== item.id))}>
                    Kapat
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className={styles.resultsSection} aria-labelledby="poster-results-title">
          <header>
            <div>
              <span className={styles.eyebrow}><Sparkles aria-hidden="true" /> Hazır tasarımlar</span>
              <h2 id="poster-results-title">Oluşturulan posterler</h2>
              <p>Posteri indirin, portföye kaydedin veya paylaşım metnini hazırlayın.</p>
            </div>
            <span className={styles.readyBadge}><Check aria-hidden="true" /> {results.length} hazır</span>
          </header>
          <div className={styles.resultGrid}>
            {results.map((result) => (
              <article key={result.id} className={styles.resultCard}>
                <div className={styles.resultImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.previewUrl}
                    alt={result.name}
                    style={{
                      aspectRatio:
                        result.brief.outputSize === 'wide'
                          ? '3 / 1'
                          : result.brief.outputSize === 'square'
                            ? '1 / 1'
                            : '4 / 5',
                    }}
                  />
                  <span>Bannerbear şablonuyla oluşturuldu</span>
                </div>
                <div className={styles.resultBody}>
                  <div className={styles.resultTitle}>
                    <div>
                      <h3>{result.name}</h3>
                      <p>
                        {result.platforms
                          .map((id) => PLATFORM_OPTIONS.find((platform) => platform.id === id)?.name)
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <a
                      href={result.previewUrl}
                      download={(result.name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '_') || 'business_ceo_ai_poster') + '.jpg'}
                      aria-label={result.name + ' posterini indir'}
                    >
                      <Download aria-hidden="true" />
                    </a>
                  </div>
                  {result.requiresTextReview && (
                    <div className={styles.aiReviewNotice}>
                      <Eye aria-hidden="true" />
                      <span>
                        <strong>AI metinlerini kontrol edin</strong>
                        <small>
                          Yayınlamadan önce fiyatı, konumu, telefonu ve Türkçe yazıları gözden geçirin.
                          {result.providerCostUsd !== null
                            ? ` Bu üretim: $${result.providerCostUsd.toFixed(4)}`
                            : ''}
                        </small>
                      </span>
                    </div>
                  )}
                  {!result.requiresTextReview && (
                    <div className={styles.aiVerifiedNotice}>
                      <Check aria-hidden="true" />
                      <span>
                        <strong>Metinler doğru yerleştirildi</strong>
                        <small>
                          Seçilen fotoğraf yeniden çizilmedi; bilgiler portföy kaydından alınıp şablona yerleştirildi.
                          {result.providerCostUsd === 0
                            ? ' Üretken görsel AI ücreti yok; bir Bannerbear kredisi kullanıldı.'
                            : result.providerCostUsd !== null
                              ? ` Ek görsel üretim ücreti: $${result.providerCostUsd.toFixed(4)}`
                              : ''}
                        </small>
                      </span>
                    </div>
                  )}
                  <div className={styles.resultActions}>
                    {result.brief.propertyId && (
                      <button
                        type="button"
                        onClick={() => savePosterToProperty(result.id)}
                        disabled={result.saveLoading || Boolean(result.savedMediaId)}
                      >
                        {result.saveLoading ? <Loader2 className={styles.spin} aria-hidden="true" /> : <Check aria-hidden="true" />}
                        {result.savedMediaId ? 'Portföye kaydedildi' : 'Portföye kaydet'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void createPoster(result)}
                      disabled={isCreating || result.remainingRegenerations <= 0}
                    >
                      <RotateCcw aria-hidden="true" />
                      {result.remainingRegenerations > 0
                        ? 'Yeniden üret · ' + result.remainingRegenerations + ' hak'
                        : 'Hak kalmadı'}
                    </button>
                    <button
                      type="button"
                      onClick={() => createCampaign(result.id)}
                      disabled={result.campaignLoading}
                    >
                      {result.campaignLoading ? <Loader2 className={styles.spin} aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                      Paylaşım metni hazırla
                    </button>
                  </div>
                  {result.whatsapp && (
                    <div className={styles.copyBox}>
                      <div>
                        <strong><MessageCircle aria-hidden="true" /> WhatsApp mesajı</strong>
                        <button type="button" onClick={() => copy(result.whatsapp || '', 'WhatsApp mesajı')}>
                          <Copy aria-hidden="true" /> Kopyala
                        </button>
                      </div>
                      <p>{result.whatsapp}</p>
                    </div>
                  )}
                  {result.instagram && (
                    <div className={styles.copyBox}>
                      <div>
                        <strong><Share2 aria-hidden="true" /> Instagram açıklaması</strong>
                        <button type="button" onClick={() => copy(result.instagram || '', 'Instagram açıklaması')}>
                          <Copy aria-hidden="true" /> Kopyala
                        </button>
                      </div>
                      <p>{result.instagram}</p>
                      <button type="button" className={styles.instagramAction} onClick={() => shareOnInstagram(result)}>
                        <Share2 aria-hidden="true" /> Instagram için hazırla
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={styles.mediaArchive} aria-labelledby="media-archive-title">
        <header className={styles.mediaArchiveHeader}>
          <div>
            <span className={styles.eyebrow}><FolderOpen aria-hidden="true" /> Çalışma arşivi</span>
            <h2 id="media-archive-title">Fotoğraf ve video geçmişi</h2>
            <p>Üretilen çalışmalar portföy adına göre otomatik klasörlenir.</p>
          </div>
          <button
            type="button"
            className={styles.historyRefresh}
            onClick={() => void loadHistory(true)}
            disabled={isHistoryLoading}
          >
            <RefreshCw className={isHistoryLoading ? styles.spin : undefined} aria-hidden="true" />
            Yenile
          </button>
        </header>

        <div className={styles.archiveTabs} role="tablist" aria-label="Çalışma türü">
          <button
            type="button"
            role="tab"
            aria-selected={historyKind === 'photos'}
            className={historyKind === 'photos' ? styles.archiveTabActive : undefined}
            onClick={() => setHistoryKind('photos')}
          >
            <ImageIcon aria-hidden="true" /> Fotoğraflar <b>{historyTotals.photos}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={historyKind === 'videos'}
            className={historyKind === 'videos' ? styles.archiveTabActive : undefined}
            onClick={() => setHistoryKind('videos')}
          >
            <Film aria-hidden="true" /> Videolar <b>{historyTotals.videos}</b>
          </button>
        </div>

        {isHistoryLoading ? (
          <div className={styles.archiveEmpty} aria-live="polite">
            <Loader2 className={styles.spin} aria-hidden="true" /> Geçmiş hazırlanıyor…
          </div>
        ) : visibleHistoryFolders.length === 0 ? (
          <div className={styles.archiveEmpty}>
            {historyKind === 'photos' ? <ImageIcon aria-hidden="true" /> : <Film aria-hidden="true" />}
            <strong>Henüz kayıt yok</strong>
            <span>İlk çalışmanızı oluşturduğunuzda burada otomatik görünecek.</span>
          </div>
        ) : (
          <div className={styles.archiveWorkspace}>
            <nav className={styles.folderRail} aria-label="Portföy klasörleri">
              {visibleHistoryFolders.map((folder) => {
                const selected = activeHistoryFolder?.id === folder.id;
                const count = historyKind === 'photos' ? folder.photos.length : folder.videos.length;
                return (
                  <button
                    type="button"
                    key={folder.id}
                    aria-current={selected ? 'page' : undefined}
                    className={selected ? styles.folderActive : undefined}
                    onClick={() => setHistoryFolderId(folder.id)}
                  >
                    <span className={styles.folderIcon}>
                      {selected ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" />}
                    </span>
                    <span>
                      <strong>{folder.name}</strong>
                      <small>{folder.location || 'Konum belirtilmemiş'}</small>
                    </span>
                    <b>{count}</b>
                  </button>
                );
              })}
            </nav>

            <div className={styles.folderContents} role="tabpanel">
              <div className={styles.folderContentsHeader}>
                <div>
                  <strong>{activeHistoryFolder?.name}</strong>
                  <small>{historyKind === 'photos' ? 'Poster fotoğrafları' : 'Portföy videoları'}</small>
                </div>
                <span>
                  {historyKind === 'photos'
                    ? activeHistoryFolder?.photos.length
                    : activeHistoryFolder?.videos.length}{' '}
                  çalışma
                </span>
              </div>

              {historyKind === 'photos' ? (
                <div className={styles.historyGrid}>
                  {activeHistoryFolder?.photos.map((photo) => (
                    <article className={styles.historyCard} key={photo.id}>
                      <a href={photo.url} target="_blank" rel="noreferrer" className={styles.historyPreview}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.name} loading="lazy" />
                        <span>{photo.format === 'story' ? 'Hikâye' : 'Gönderi'}</span>
                      </a>
                      <div className={styles.historyMeta}>
                        <span><strong>{photo.name}</strong><small>{historyDate(photo.createdAt)}{historyFileSize(photo.byteSize) ? ` · ${historyFileSize(photo.byteSize)}` : ''}</small></span>
                        <a href={photo.url} download aria-label={`${photo.name} indir`}><Download aria-hidden="true" /></a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.historyGrid}>
                  {activeHistoryFolder?.videos.map((video) => (
                    <article className={styles.historyCard} key={video.id}>
                      <video
                        controls
                        playsInline
                        preload="none"
                        poster={video.thumbnailUrl || undefined}
                        className={styles.historyVideo}
                      >
                        <source src={video.url} type="video/mp4" />
                        Tarayıcınız video oynatmayı desteklemiyor.
                      </video>
                      <div className={styles.historyMeta}>
                        <span><strong>{video.name}</strong><small>{historyDate(video.createdAt)} · {video.durationSeconds} sn{historyFileSize(video.byteSize) ? ` · ${historyFileSize(video.byteSize)}` : ''}</small></span>
                        <a href={video.url} download aria-label={`${video.name} indir`}><Download aria-hidden="true" /></a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

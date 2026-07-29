import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import type {
  AddressPrecision,
  ParsedListingDetail,
  ParsedListingImage,
  ParsedSearchPage,
} from './types';

const challengeMarkers = [
  'robot olmadığınızı doğrulayın',
  'güvenlik doğrulaması',
  'captcha',
  'access denied',
  'erişim engellendi',
];

export function detectSourceChallenge(html: string) {
  const normalized = html.toLocaleLowerCase('tr-TR');
  return challengeMarkers.some((marker) => normalized.includes(marker));
}

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function listingIdFromUrl(value: string) {
  const path = new URL(value).pathname;
  const match =
    path.match(/(?:^|[-/])([a-z]+-\d{4,})(?:\/|$)/i) ||
    path.match(/(?:^|[-/])(\d{5,})(?:\/|$)/);
  return match?.[1] || null;
}

function cleanText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function parseSearchResultsHtml(
  html: string,
  pageUrl: string
): ParsedSearchPage {
  const $ = load(html);
  const unique = new Map<string, ParsedSearchPage['listings'][number]>();

  $('.searchResultsItem, [data-listing-id]').each((_, element) => {
    const row = $(element);
    const anchor = row.find('a.classifiedTitle, a[data-listing-link]').first();
    const sourceUrl = absoluteUrl(anchor.attr('href'), pageUrl);
    if (!sourceUrl) return;

    const sourceListingId =
      row.attr('data-id') ||
      row.attr('data-listing-id') ||
      listingIdFromUrl(sourceUrl);
    const title = cleanText(anchor.text());
    if (!sourceListingId || !title || unique.has(sourceListingId)) return;

    unique.set(sourceListingId, {
      sourceListingId,
      sourceUrl,
      title,
      priceText: cleanText(
        row.find('.searchResultsPriceValue, [data-listing-price]').first().text()
      ),
      locationText: cleanText(
        row
          .find('.searchResultsLocationValue, [data-listing-location]')
          .first()
          .text()
      ),
    });
  });

  const nextHref =
    $('a[rel="next"]').first().attr('href') ||
    $('a.prevNextBut:contains("Sonraki")').first().attr('href');

  return {
    listings: [...unique.values()],
    nextPageUrl: absoluteUrl(nextHref, pageUrl),
  };
}

function parsePrice(value: string | null) {
  if (!value) return { amount: null, currency: null };
  const currency = /(?:₺|\bTL\b|\bTRY\b)/i.test(value)
    ? 'TRY'
    : /(?:€|\bEUR\b)/i.test(value)
      ? 'EUR'
      : /(?:\\$|\bUSD\b)/i.test(value)
        ? 'USD'
        : null;
  const digits = value.replace(/[^\d.,]/g, '');
  const normalized = digits
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

function parseTurkishDate(value: string | null) {
  if (!value) return null;
  const months: Record<string, number> = {
    ocak: 0,
    şubat: 1,
    mart: 2,
    nisan: 3,
    mayıs: 4,
    haziran: 5,
    temmuz: 6,
    ağustos: 7,
    eylül: 8,
    ekim: 9,
    kasım: 10,
    aralık: 11,
  };
  const match = value
    .toLocaleLowerCase('tr-TR')
    .match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/i);
  if (!match || months[match[2]] === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), months[match[2]], Number(match[1])));
}

function addressPrecision(
  province: string | null,
  district: string | null,
  neighborhood: string | null,
  street: string | null,
  latitude: number | null,
  longitude: number | null
): AddressPrecision {
  if (latitude !== null && longitude !== null) return 'EXACT';
  if (street) return 'STREET';
  if (neighborhood) return 'NEIGHBORHOOD';
  if (district) return 'DISTRICT';
  if (province) return 'CITY';
  return 'UNKNOWN';
}

function parseCoordinate(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function imageMimeType(sourceUrl: string) {
  const extension = new URL(sourceUrl).pathname.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

export function parseListingDetailHtml(
  html: string,
  sourceUrl: string
): ParsedListingDetail {
  const $ = load(html);
  const attributes: Record<string, string> = {};

  $('.classifiedInfoList li, .classifiedInfo li, [data-attribute-row]').each(
    (_, element) => {
      const row = $(element);
      const label = cleanText(
        row.find('strong, [data-attribute-label]').first().text()
      );
      const explicitValue = row
        .find('span, [data-attribute-value]')
        .first()
        .text();
      const value = cleanText(
        explicitValue || row.text().replace(label || '', '')
      );
      if (label && value) attributes[label] = value;
    }
  );

  const listingId =
    attributes['İlan No'] ||
    $('[data-listing-id]').first().attr('data-listing-id') ||
    listingIdFromUrl(sourceUrl) ||
    new URL(sourceUrl).pathname;
  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content')) ||
    'Başlıksız ilan';
  const priceText = cleanText(
    $('.classifiedInfo h3, .classified-price-container, [data-price]')
      .first()
      .text()
  );
  const price = parsePrice(priceText);

  const descriptionNode = $(
    '.classifiedDescription, [data-listing-description]'
  ).first();
  const descriptionHtml = descriptionNode.html();
  const sanitizedDescriptionHtml = descriptionHtml
    ? sanitizeHtml(descriptionHtml, {
        allowedTags: [
          'p',
          'br',
          'strong',
          'b',
          'em',
          'i',
          'ul',
          'ol',
          'li',
          'a',
        ],
        allowedAttributes: { a: ['href', 'title'] },
        allowedSchemes: ['https', 'http', 'mailto'],
      })
    : null;

  const locationParts = $(
    '.classifiedDetailLocation a, [data-location-part]'
  )
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter((value): value is string => Boolean(value));
  const province = locationParts[0] || null;
  const district = locationParts[1] || null;
  const neighborhood = locationParts[2]?.replace(/\s+Mah\.?$/i, '') || null;
  const street = locationParts[3] || null;
  const latitude = parseCoordinate(
    $('meta[itemprop="latitude"], [data-latitude]')
      .first()
      .attr('content') ||
      $('[data-latitude]').first().attr('data-latitude')
  );
  const longitude = parseCoordinate(
    $('meta[itemprop="longitude"], [data-longitude]')
      .first()
      .attr('content') ||
      $('[data-longitude]').first().attr('data-longitude')
  );

  const images: ParsedListingImage[] = [];
  const seenImages = new Set<string>();
  $(
    '.classifiedDetailMainPhoto img, [data-listing-gallery] img, img[data-gallery-image]'
  ).each((index, element) => {
    const image = $(element);
    const candidate =
      image.attr('data-src') || image.attr('data-original') || image.attr('src');
    const resolved = absoluteUrl(candidate, sourceUrl);
    if (!resolved || seenImages.has(resolved)) return;
    seenImages.add(resolved);
    const explicitOrder = Number(
      image.closest('[data-order]').attr('data-order') ||
        image.attr('data-order') ||
        index + 1
    );
    images.push({
      order: Number.isFinite(explicitOrder) ? explicitOrder : index + 1,
      sourceUrl: resolved,
      mimeType: imageMimeType(resolved),
      width: Number(image.attr('width')) || null,
      height: Number(image.attr('height')) || null,
    });
  });
  images.sort((left, right) => left.order - right.order);

  const categoryValue =
    attributes['Emlak Tipi'] || attributes['Kategori'] || null;
  const filled = [
    title,
    priceText,
    sanitizedDescriptionHtml,
    province,
    district,
    neighborhood,
    images.length ? 'media' : null,
    Object.keys(attributes).length ? 'attributes' : null,
  ].filter(Boolean).length;

  return {
    sourceListingId: listingId,
    sourceUrl,
    title,
    priceText,
    priceAmount: price.amount,
    currency: price.currency,
    listingPublishedAt: parseTurkishDate(attributes['İlan Tarihi'] || null),
    category: categoryValue?.split(/\s+/)[0] || null,
    subcategory: categoryValue,
    sellerType: null,
    descriptionText: cleanText(descriptionNode.text()),
    sanitizedDescriptionHtml,
    province,
    district,
    neighborhood,
    street,
    latitude,
    longitude,
    addressPrecision: addressPrecision(
      province,
      district,
      neighborhood,
      street,
      latitude,
      longitude
    ),
    attributes,
    images,
    completenessScore: Math.round((filled / 8) * 100),
  };
}

import prisma from './prisma';

export type AssistantProperty = {
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  updatedAt: Date;
};

const MAX_PROMPT_PROPERTIES = 80;
const STOP_WORDS = new Set([
  'bana',
  'bir',
  'icin',
  'istiyorum',
  'lazim',
  'misiniz',
  'var',
  'yardimci',
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function words(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function fuzzyTokenMatch(left: string, right: string) {
  return left === right || left.includes(right) || right.includes(left);
}

export function rankAssistantProperties(
  properties: AssistantProperty[],
  customerMessage: string
) {
  const messageWords = words(customerMessage);

  return properties
    .map((property, index) => {
      const locationWords = words(property.location || '');
      const titleWords = words(property.title);
      const roomWords = words(property.roomCount || '');
      const descriptionWords = words(property.description || '');
      let score = 0;

      for (const messageWord of messageWords) {
        if (locationWords.some((word) => fuzzyTokenMatch(messageWord, word))) {
          score += 12;
        }
        if (roomWords.some((word) => fuzzyTokenMatch(messageWord, word))) {
          score += 8;
        }
        if (titleWords.some((word) => fuzzyTokenMatch(messageWord, word))) {
          score += 5;
        }
        if (
          descriptionWords.some((word) => fuzzyTokenMatch(messageWord, word))
        ) {
          score += 2;
        }
      }

      return { property, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function buildAssistantPropertyContext(
  properties: AssistantProperty[],
  customerMessage: string
) {
  const ranked = rankAssistantProperties(properties, customerMessage);
  const selected =
    ranked.length <= MAX_PROMPT_PROPERTIES
      ? ranked
      : [
          ...ranked.filter((item) => item.score > 0).slice(0, 50),
          ...ranked.filter((item) => item.score === 0).slice(0, 30),
        ].slice(0, MAX_PROMPT_PROPERTIES);

  return JSON.stringify({
    totalActiveListings: properties.length,
    matchingListingsFirst: true,
    listings: selected.map(({ property }) => ({
      title: property.title,
      referenceCode: property.referenceCode,
      location: property.location,
      price: property.price,
      roomCount: property.roomCount,
      area: property.area,
      description: property.description,
    })),
  });
}

export async function loadAssistantPropertyContext(
  companyAccountId: string,
  customerMessage: string
) {
  const properties = await prisma.crmProperty.findMany({
    where: {
      companyAccountId,
      status: 'ACTIVE',
    },
    select: {
      title: true,
      referenceCode: true,
      location: true,
      price: true,
      roomCount: true,
      area: true,
      description: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return buildAssistantPropertyContext(properties, customerMessage);
}

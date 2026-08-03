import { z } from 'zod';
import {
  portfolioVideoDirectionSchema,
  portfolioVideoStyleSchema,
  type PortfolioVideoDirection,
  type PortfolioVideoStyle,
} from './types';

export const creativeDirectionInputSchema = z.object({
  command: z.string().trim().max(1_000).default(''),
  preferredStyle: portfolioVideoStyleSchema.optional(),
});

export type CreativeDirectionInput = z.infer<typeof creativeDirectionInputSchema>;

export interface CreativeDirector {
  direct(input: CreativeDirectionInput): PortfolioVideoDirection;
}

function normalizeTurkish(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferStyle(command: string, preferredStyle?: PortfolioVideoStyle) {
  if (/dikkat cekici|enerjik|guclu|hizli/.test(command)) return 'BOLD' as const;
  if (/luks|sinematik|zarif|prestij/.test(command)) return 'CINEMATIC' as const;
  if (/aile|cocuk|yasam/.test(command)) return 'FAMILY' as const;
  if (/yatirim|getiri|kazanc|firsat/.test(command)) return 'INVESTMENT' as const;
  if (/sade|minimal|az efekt|temiz/.test(command)) return 'MINIMAL' as const;
  return preferredStyle ?? ('BALANCED' as const);
}

function styleSettings(style: PortfolioVideoStyle) {
  switch (style) {
    case 'BOLD':
      return {
        pace: 'FAST' as const,
        tone: 'CONFIDENT' as const,
        effectIntensity: 0.82,
        galleryTransition: 'CUT' as const,
        photoMotion: 'ZOOM' as const,
      };
    case 'CINEMATIC':
      return {
        pace: 'SLOW' as const,
        tone: 'ELEGANT' as const,
        effectIntensity: 0.58,
        galleryTransition: 'FADE' as const,
        photoMotion: 'PAN' as const,
      };
    case 'FAMILY':
      return {
        pace: 'MEDIUM' as const,
        tone: 'WARM' as const,
        effectIntensity: 0.48,
        galleryTransition: 'SLIDE' as const,
        photoMotion: 'PAN' as const,
      };
    case 'INVESTMENT':
      return {
        pace: 'MEDIUM' as const,
        tone: 'ANALYTICAL' as const,
        effectIntensity: 0.42,
        galleryTransition: 'CUT' as const,
        photoMotion: 'STILL' as const,
      };
    case 'MINIMAL':
      return {
        pace: 'SLOW' as const,
        tone: 'CLEAN' as const,
        effectIntensity: 0.2,
        galleryTransition: 'FADE' as const,
        photoMotion: 'STILL' as const,
      };
    default:
      return {
        pace: 'MEDIUM' as const,
        tone: 'CONFIDENT' as const,
        effectIntensity: 0.5,
        galleryTransition: 'FADE' as const,
        photoMotion: 'ZOOM' as const,
      };
  }
}

function extractQuotedInstruction(rawCommand: string, position: 'opening' | 'closing') {
  const marker = position === 'opening'
    ? '(?:ilk\\s+(?:kisimda|sahnede|karede)|basta|baslangicta)'
    : '(?:en\\s+son(?:\\s+kisimda|\\s+sahnede|\\s+karede)?|sonunda|kapanista)';
  const normalized = normalizeTurkish(rawCommand);
  const markerMatch = new RegExp(marker, 'i').exec(normalized);
  if (!markerMatch) return null;

  const markerWords = markerMatch[0].split(' ').filter(Boolean).length;
  const rawWords = [...rawCommand.matchAll(/\S+/g)];
  const normalizedWords = [...normalized.matchAll(/\S+/g)];
  const normalizedWordIndex = normalizedWords.findIndex(
    (match) => (match.index ?? 0) >= markerMatch.index
  );
  const rawStart = rawWords[Math.max(0, normalizedWordIndex + markerWords - 1)]?.index ?? 0;
  const tail = rawCommand.slice(rawStart);
  const quoted = tail.match(/["“”'‘’]([^"“”'‘’]{2,120})["“”'‘’]/u)?.[1]?.trim();
  return quoted || null;
}

function applyCommandOverrides(command: string, settings: ReturnType<typeof styleSettings>) {
  let galleryTransition = settings.galleryTransition;
  let photoMotion = settings.photoMotion;
  let effectIntensity = settings.effectIntensity;

  if (/sira sira|tek tek|kayarak|animasyon/.test(command)) galleryTransition = 'SLIDE';
  if (/yumusak gecis|solarak|fade/.test(command)) galleryTransition = 'FADE';
  if (/sert gecis|hizli kes|cut/.test(command)) galleryTransition = 'CUT';

  if (/sabit|hareketsiz/.test(command)) photoMotion = 'STILL';
  else if (/kaydir|pan|sira sira|animasyon/.test(command)) photoMotion = 'PAN';
  else if (/yakinlas|zoom/.test(command)) photoMotion = 'ZOOM';

  if (/animasyon|hareketli|dinamik/.test(command)) {
    effectIntensity = Math.max(effectIntensity, 0.72);
  }

  return { galleryTransition, photoMotion, effectIntensity };
}

function shouldHidePrice(command: string) {
  return /fiyati gosterme|fiyat gosterme|fiyat olmasin|fiyatsiz|fiyati gizle|fiyat gizle/.test(
    command
  );
}

export class LocalRuleCreativeDirector implements CreativeDirector {
  direct(rawInput: CreativeDirectionInput): PortfolioVideoDirection {
    const input = creativeDirectionInputSchema.parse(rawInput);
    const command = normalizeTurkish(input.command);
    const style = inferStyle(command, input.preferredStyle);
    const settings = styleSettings(style);
    const overrides = applyCommandOverrides(command, settings);
    return portfolioVideoDirectionSchema.parse({
      style,
      ...settings,
      ...overrides,
      showPrice: !shouldHidePrice(command),
      openingMessage: extractQuotedInstruction(input.command, 'opening'),
      closingMessage: extractQuotedInstruction(input.command, 'closing'),
      commandSummary: input.command.slice(0, 240),
    });
  }
}

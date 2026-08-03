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
      return { pace: 'FAST' as const, tone: 'CONFIDENT' as const, effectIntensity: 0.82 };
    case 'CINEMATIC':
      return { pace: 'SLOW' as const, tone: 'ELEGANT' as const, effectIntensity: 0.58 };
    case 'FAMILY':
      return { pace: 'MEDIUM' as const, tone: 'WARM' as const, effectIntensity: 0.48 };
    case 'INVESTMENT':
      return { pace: 'MEDIUM' as const, tone: 'ANALYTICAL' as const, effectIntensity: 0.42 };
    case 'MINIMAL':
      return { pace: 'SLOW' as const, tone: 'CLEAN' as const, effectIntensity: 0.2 };
    default:
      return { pace: 'MEDIUM' as const, tone: 'CONFIDENT' as const, effectIntensity: 0.5 };
  }
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
    return portfolioVideoDirectionSchema.parse({
      style,
      ...settings,
      showPrice: !shouldHidePrice(command),
      commandSummary: input.command.slice(0, 240),
    });
  }
}

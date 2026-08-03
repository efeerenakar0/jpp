import 'server-only';

import { callAI, parseJSONResponse, type ChatMessage } from '../ai';
import {
  callCompanyMarketingAI,
  type MarketingAIResult,
} from '../marketing-ai';
import type { PortfolioVideoPortfolio } from './types';
import {
  buildLocalScenePlan,
  parseCreativeScenePlan,
  type PortfolioVideoScenePlan,
} from './scene-plan';

type CreativeSceneDirectorInput = {
  companyAccountId: string;
  command: string;
  portfolio: PortfolioVideoPortfolio;
  photoCount: number;
  showPrice: boolean;
  showLocation: boolean;
};

type SceneDirectorCaller = (
  accountId: string,
  messages: ChatMessage[]
) => Promise<MarketingAIResult>;

export type CreativeSceneDirectorResult = {
  plan: PortfolioVideoScenePlan;
  source: MarketingAIResult['provider'];
  model: string | null;
  usedFallback: boolean;
};

function verifiedPortfolioFacts(portfolio: PortfolioVideoPortfolio) {
  return {
    title: portfolio.title,
    referenceCode: portfolio.referenceCode,
    location: portfolio.location,
    price: portfolio.price,
    roomCount: portfolio.roomCount,
    area: portfolio.area,
    description: portfolio.description,
    features: portfolio.features,
    companyName: portfolio.company.name,
    instagramUrl: portfolio.company.instagramUrl,
    advisorName: portfolio.advisor.name,
    advisorPhone: portfolio.advisor.phone,
    photoCount: portfolio.photos.length,
  };
}

function directorMessages(input: CreativeSceneDirectorInput): ChatMessage[] {
  const photoIndices = Array.from({ length: input.photoCount }, (_, index) => index);
  return [
    {
      role: 'system',
      content: `Sen bir gayrimenkul kısa video yönetmenisin. Kullanıcının Türkçe yaratıcı talimatını 15 saniyelik güvenli bir sahne planına dönüştür.
Yalnızca geçerli JSON döndür; markdown, açıklama, kod, HTML, JSX, eval veya fonksiyon döndürme.
Toplam 3-10 sahne kullan. durationSeconds değerlerinin toplamı yaklaşık 15 olsun.
Sahne type değerleri: HOOK, GALLERY, FEATURES, DETAILS, CONTACT.
layout: FULL_BLEED, FRAMED, FEATURE_GRID, CONTACT_CARD.
transition: CUT, FADE, SLIDE. photoMotion: ZOOM, PAN, STILL.
overlay type: BRAND, TITLE, DESCRIPTION, PRICE, LOCATION, DETAILS, FEATURES, CONTACT, INSTAGRAM, CUSTOM.
overlay animation: FADE, SLIDE_UP, POP, TYPE. position: TOP, CENTER, BOTTOM.
revealAtFrame sahnenin kendi içindeki gecikmedir. Bir anda belirme için POP kullan.
Yalnız verilen doğrulanmış portföy bilgilerini ve kullanıcının açıkça istediği özel metni kullan. Fiyat, özellik veya sosyal hesap uydurma.
Kullanıcı sahne sırası ve zamanlama tarif ettiyse sabit şablon kullanma; sahneleri o sıraya göre kur.
Çıktı şeması: {"summary":"...","scenes":[{"type":"HOOK","durationSeconds":2,"photoIndices":[0],"layout":"FULL_BLEED","transition":"FADE","photoMotion":"ZOOM","headline":"...","body":null,"overlays":[{"type":"TITLE","text":null,"animation":"SLIDE_UP","position":"BOTTOM","revealAtFrame":8}]}]}`,
    },
    {
      role: 'user',
      content: `Kullanıcı talimatı: ${input.command}
Fiyat gösterilebilir: ${input.showPrice ? 'evet' : 'hayır'}
Konum gösterilebilir: ${input.showLocation ? 'evet' : 'hayır'}
Kullanılabilir fotoğraf indeksleri: ${JSON.stringify(photoIndices)}
Doğrulanmış portföy: ${JSON.stringify(verifiedPortfolioFacts(input.portfolio))}`,
    },
  ];
}

async function callPlatformSceneDirector(
  _accountId: string,
  messages: ChatMessage[]
): Promise<MarketingAIResult> {
  try {
    const response = await callAI(messages, 'marketing-video-director');
    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
    };
  } catch {
    return { content: '', provider: 'RULE_ENGINE', model: null };
  }
}

async function callCompanySceneDirector(
  accountId: string,
  messages: ChatMessage[]
): Promise<MarketingAIResult> {
  return callCompanyMarketingAI(accountId, messages, { jsonMode: true });
}

function repairMessages(messages: ChatMessage[]): ChatMessage[] {
  return [
    ...messages,
    {
      role: 'user',
      content:
        'Önceki yanıt zorunlu sahne şemasına uymadı. Talimatı yeniden yorumla; bu kez yalnızca belirtilen JSON şemasını, en az 3 sahneyle ve desteklenen enum değerleriyle döndür.',
    },
  ];
}

function validatedScenePlan(
  result: MarketingAIResult,
  photoCount: number
): PortfolioVideoScenePlan | null {
  const parsedJson = result.content ? parseJSONResponse(result.content) : null;
  if (!parsedJson) return null;
  try {
    return parseCreativeScenePlan(parsedJson, { photoCount });
  } catch {
    return null;
  }
}

export async function createCreativeScenePlan(
  input: CreativeSceneDirectorInput,
  callDirector: SceneDirectorCaller = callCompanySceneDirector,
  callFallbackDirector: SceneDirectorCaller = callPlatformSceneDirector
): Promise<CreativeSceneDirectorResult> {
  const fallback = buildLocalScenePlan({
    command: input.command,
    photoCount: input.photoCount,
    showPrice: input.showPrice,
    showLocation: input.showLocation,
    instagramUrl: input.portfolio.company.instagramUrl,
  });
  const messages = directorMessages(input);
  const ai = await callDirector(input.companyAccountId, messages);
  const primaryPlan = validatedScenePlan(ai, input.photoCount);
  if (primaryPlan) {
    return {
      plan: primaryPlan,
      source: ai.provider,
      model: ai.model,
      usedFallback: false,
    };
  }

  let repairedAI: MarketingAIResult | null = null;
  if (ai.provider !== 'RULE_ENGINE') {
    repairedAI = await callDirector(
      input.companyAccountId,
      repairMessages(messages)
    );
    const repairedPlan = validatedScenePlan(repairedAI, input.photoCount);
    if (repairedPlan) {
      return {
        plan: repairedPlan,
        source: repairedAI.provider,
        model: repairedAI.model,
        usedFallback: false,
      };
    }
  }

  if (
    ai.provider === 'OPENROUTER' ||
    repairedAI?.provider === 'OPENROUTER'
  ) {
    const platformAI = await callFallbackDirector(input.companyAccountId, messages);
    const platformPlan = validatedScenePlan(platformAI, input.photoCount);
    if (platformPlan) {
      return {
        plan: platformPlan,
        source: platformAI.provider,
        model: platformAI.model,
        usedFallback: false,
      };
    }
  }

  return { plan: fallback, source: 'RULE_ENGINE', model: null, usedFallback: true };
}

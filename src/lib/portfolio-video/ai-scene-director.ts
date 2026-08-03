import 'server-only';

import { parseJSONResponse, type ChatMessage } from '../ai';
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

export async function createCreativeScenePlan(
  input: CreativeSceneDirectorInput,
  callDirector: SceneDirectorCaller = callCompanyMarketingAI
): Promise<CreativeSceneDirectorResult> {
  const fallback = buildLocalScenePlan({
    command: input.command,
    photoCount: input.photoCount,
    showPrice: input.showPrice,
    showLocation: input.showLocation,
    instagramUrl: input.portfolio.company.instagramUrl,
  });
  const ai = await callDirector(input.companyAccountId, directorMessages(input));
  const parsedJson = ai.content ? parseJSONResponse(ai.content) : null;
  if (!parsedJson) {
    return { plan: fallback, source: 'RULE_ENGINE', model: null, usedFallback: true };
  }
  try {
    return {
      plan: parseCreativeScenePlan(parsedJson, { photoCount: input.photoCount }),
      source: ai.provider,
      model: ai.model,
      usedFallback: false,
    };
  } catch {
    return { plan: fallback, source: 'RULE_ENGINE', model: null, usedFallback: true };
  }
}

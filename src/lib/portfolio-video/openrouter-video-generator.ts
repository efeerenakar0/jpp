import 'server-only';
import { aiVideoDimensions, aiVideoProgramSchema, type AiVideoDuration, type AiVideoFormat, type AiVideoModelPortfolio } from './ai-video-types';
import { sanitizeGeneratedRemotionCode, sanitizeVideoPrompt } from './ai-video-security';

const DEFAULT_PRIMARY = 'poolside/laguna-s-2.1:free';
const DEFAULT_FIXER = 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_PAID = 'qwen/qwen3-coder-next';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

type Fetcher = typeof fetch;
type Dependencies = {
  apiKey?: string;
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  models?: { primary: string; fixer: string; paid: string };
  signal?: AbortSignal;
};

export type GeneratePortfolioVideoInput = {
  creativeSeed: number;
  format: AiVideoFormat;
  durationSeconds: AiVideoDuration;
  prompt: string;
  portfolio: AiVideoModelPortfolio;
};

function parseContent(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('OpenRouter yanıtı boş.');
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') throw new Error('OpenRouter yanıtı geçersiz.');
  const message = (choices[0] as { message?: unknown }).message;
  const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : null;
  if (typeof content !== 'string') throw new Error('OpenRouter kod yanıtı bulunamadı.');
  return content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function validateProgram(content: string, input: GeneratePortfolioVideoInput) {
  const parsed = aiVideoProgramSchema.parse(JSON.parse(content));
  if (parsed.plan.creativeSeed !== input.creativeSeed || parsed.plan.format !== input.format || parsed.plan.durationSeconds !== input.durationSeconds) {
    throw new Error('AI video planı istenen seed, format veya süreye uymuyor.');
  }
  const dimensions = aiVideoDimensions(input.format);
  if (parsed.plan.width !== dimensions.width || parsed.plan.height !== dimensions.height) throw new Error('AI video ölçüleri geçersiz.');
  const assetIds = new Set(input.portfolio.assets.map((asset) => asset.assetId));
  if (parsed.plan.scenes.some((scene) => scene.assetIds.some((id) => !assetIds.has(id)))) throw new Error('AI başka bir portföye ait görsel kullanmaya çalıştı.');
  const sanitized = sanitizeGeneratedRemotionCode(parsed.code);
  const embedded = aiVideoProgramSchema.shape.plan.parse(sanitized.embeddedPlan);
  if (JSON.stringify(embedded) !== JSON.stringify(parsed.plan)) {
    throw new Error('Kod içindeki video planı doğrulanan JSON planıyla uyuşmuyor.');
  }
  return { plan: parsed.plan, code: sanitized.code, codeHash: sanitized.hash };
}

function systemPrompt(input: GeneratePortfolioVideoInput) {
  const dimensions = aiVideoDimensions(input.format);
  return `Kıdemli bir Remotion yönetmenisin. YALNIZ geçerli JSON döndür: {"plan": VideoPlan, "code": string}. Markdown veya açıklama kullanma.

VideoPlan TAM OLARAK şu alanlardan oluşur; başka alan ekleme:
{
  "schemaVersion": 1,
  "creativeSeed": ${input.creativeSeed},
  "format": "${input.format}",
  "durationSeconds": ${input.durationSeconds},
  "fps": 30,
  "width": ${dimensions.width},
  "height": ${dimensions.height},
  "theme": {
    "background": "#RRGGBB",
    "surface": "#RRGGBB",
    "text": "#RRGGBB",
    "accent": "#RRGGBB",
    "font": "MODERN | EDITORIAL | BOLD | MINIMAL"
  },
  "scenes": [{
    "id": "yalniz-kucuk-harf-rakam-tire",
    "helper": "PropertyImage | Hero | PriceCard | FeatureGrid | LocationCard | CTA | LogoOutro | KenBurns | SplitScreen",
    "startFrame": 0,
    "durationInFrames": 90,
    "assetIds": ["verilen-assetId"],
    "factRefs": ["TITLE | REFERENCE | PRICE | LOCATION | ROOMS | AREA | FEATURE_1 | FEATURE_2 | FEATURE_3 | FEATURE_4 | FEATURE_5 | COMPANY_NAME"],
    "headline": "en fazla 90 karakter veya null",
    "body": "en fazla 160 karakter veya null",
    "motion": "STILL | ZOOM_IN | ZOOM_OUT | PAN_LEFT | PAN_RIGHT | FLOAT",
    "transition": "CUT | FADE | SLIDE | WIPE | SCALE",
    "layout": "FULL | CENTER | LEFT | RIGHT | GRID | SPLIT"
  }]
}
Sahnelerde type, duration, globalStart, globalEnd, assetId, typography veya colors alanlarını KULLANMA. startFrame ve durationInFrames tam sayı kare değeridir. En az 3 en fazla 12 sahne üret; ilk sahne startFrame=0 olsun, sahneler çakışmasın ve son sahne tam ${input.durationSeconds * 30}. karede bitsin. assetIds yalnız verilen assetId'lerden seçilsin. Portföy gerçeği için factRefs kullan; bilgi uydurma. Kullanıcı fiyatı gizlemek isterse PRICE factRef'i ve PriceCard helper'ını kullanma. Her seed için sahne sırası, süre, hareket, geçiş, tipografi ve renkleri gerçekten çeşitlendir.

code alanı yalnız şu güvenli yapının doldurulmuş biçimi olmalıdır; PLAN_JSON yerine plan alanının BİREBİR aynı JSON nesnesini yaz:
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GeneratedVideoRuntime } from '@business-ceo/video-runtime';
export const videoPlan = PLAN_JSON;
export default function GeneratedPortfolioVideo({facts}: {facts: unknown}) { return <AbsoluteFill><GeneratedVideoRuntime plan={videoPlan} facts={facts} /></AbsoluteFill>; }
Kod yalnız React, remotion ve @business-ceo/video-runtime importlarını kullanabilir. fetch, WebSocket, dinamik import, process/env, window/document, storage, cookie, eval, dış URL veya keyfi kod kesinlikle kullanma.
Doğrulanmış ve kişisel veriden arındırılmış portföy: ${JSON.stringify(input.portfolio)}
Kullanıcı talimatı: ${sanitizeVideoPrompt(input.prompt)}`;
}

function abortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Request aborted', 'AbortError');
}

async function callModel(input: GeneratePortfolioVideoInput, model: string, apiKey: string, fetcher: Fetcher, sleep: (ms: number) => Promise<void>, repairContext?: string, callerSignal?: AbortSignal) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (callerSignal?.aborted) throw abortReason(callerSignal);
    const timeoutSignal = AbortSignal.timeout(45_000);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 12_000,
        messages: [
          { role: 'system', content: systemPrompt(input) },
          { role: 'user', content: repairContext ? `Önceki çıktı doğrulanamadı. Hataları düzelt ve yalnız yeni JSON döndür: ${repairContext.slice(0, 8_000)}` : 'Video programını üret.' },
        ],
      }),
      signal,
    });
    if (response.ok) return parseContent(await response.json());
    if ((response.status === 429 || response.status === 503) && attempt === 0) {
      await sleep(300);
      if (callerSignal?.aborted) throw abortReason(callerSignal);
      continue;
    }
    throw new Error(`OpenRouter modeli geçici olarak kullanılamıyor (${response.status}).`);
  }
  throw new Error('OpenRouter modeli yanıt vermedi.');
}

export async function generatePortfolioRemotionProgram(input: GeneratePortfolioVideoInput, dependencies: Dependencies = {}) {
  const apiKey = dependencies.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Video üretim servisi henüz yapılandırılmadı.');
  const fetcher = dependencies.fetcher ?? fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const models = dependencies.models ?? {
    primary: process.env.OPENROUTER_VIDEO_PRIMARY_MODEL || DEFAULT_PRIMARY,
    fixer: process.env.OPENROUTER_VIDEO_FIXER_MODEL || DEFAULT_FIXER,
    paid: process.env.OPENROUTER_VIDEO_PAID_FALLBACK_MODEL || DEFAULT_PAID,
  };
  const attempts: Array<{ model: string; error: string | null }> = [];
  let repairContext = '';
  for (const model of [models.primary, models.fixer, models.paid]) {
    try {
      const content = await callModel(input, model, apiKey, fetcher, sleep, repairContext, dependencies.signal);
      const program = validateProgram(content, input);
      attempts.push({ model, error: null });
      return { ...program, model, attempts };
    } catch (error) {
      if (dependencies.signal?.aborted) throw abortReason(dependencies.signal);
      const message = error instanceof Error ? error.message : 'Doğrulama hatası';
      attempts.push({ model, error: message });
      repairContext = `${message}. Önceki yanıt güvenlik veya şema doğrulamasından geçmedi.`;
    }
  }
  throw new Error(`Video kodu üç kontrollü model denemesinden sonra doğrulanamadı: ${attempts.map((item) => item.model).join(', ')}`);
}

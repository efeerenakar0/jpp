import 'server-only';

import { AiProvider } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  companyApiKeyHint,
  decryptCompanyApiKey,
  encryptCompanyApiKey,
} from '@/lib/company-ai-credentials';
import { callAI, type ChatMessage } from '@/lib/ai';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export type MarketingAIResult = {
  content: string;
  provider: 'OPENROUTER' | 'GROQ' | 'CLOUDFLARE' | 'RULE_ENGINE';
  model: string | null;
};

type MarketingAIOptions = {
  jsonMode?: boolean;
};

export function buildOpenRouterRequestBody(
  model: string,
  messages: ChatMessage[],
  options: MarketingAIOptions = {}
) {
  return {
    model,
    messages,
    temperature: options.jsonMode ? 0.25 : 0.45,
    max_tokens: 1800,
    ...(options.jsonMode
      ? { response_format: { type: 'json_object' as const } }
      : {}),
  };
}

export async function saveCompanyMarketingCredential(input: {
  accountId: string;
  apiKey?: string;
  model?: string;
  active: boolean;
}) {
  const existing = await prisma.companyAiCredential.findUnique({
    where: {
      companyAccountId_provider: {
        companyAccountId: input.accountId,
        provider: AiProvider.OPENROUTER,
      },
    },
  });
  const apiKey = input.apiKey?.trim();
  if (!existing && !apiKey) {
    throw new Error('OpenRouter API anahtarını girin.');
  }
  if (apiKey && (!apiKey.startsWith('sk-or-') || apiKey.length < 20)) {
    throw new Error('OpenRouter API anahtarı geçersiz görünüyor.');
  }
  return prisma.companyAiCredential.upsert({
    where: {
      companyAccountId_provider: {
        companyAccountId: input.accountId,
        provider: AiProvider.OPENROUTER,
      },
    },
    create: {
      companyAccountId: input.accountId,
      provider: AiProvider.OPENROUTER,
      encryptedApiKey: encryptCompanyApiKey(apiKey || ''),
      keyHint: companyApiKeyHint(apiKey || ''),
      model: input.model?.trim() || DEFAULT_OPENROUTER_MODEL,
      active: input.active,
    },
    update: {
      ...(apiKey
        ? {
            encryptedApiKey: encryptCompanyApiKey(apiKey),
            keyHint: companyApiKeyHint(apiKey),
          }
        : {}),
      model: input.model?.trim() || DEFAULT_OPENROUTER_MODEL,
      active: input.active,
    },
  });
}

export async function getCompanyMarketingCredential(accountId: string) {
  const credential = await prisma.companyAiCredential.findUnique({
    where: {
      companyAccountId_provider: {
        companyAccountId: accountId,
        provider: AiProvider.OPENROUTER,
      },
    },
  });
  if (!credential?.active) return null;
  return {
    apiKey: decryptCompanyApiKey(credential.encryptedApiKey),
    model: credential.model?.trim() || DEFAULT_OPENROUTER_MODEL,
    keyHint: credential.keyHint,
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: MarketingAIOptions = {}
) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://jpp-ufeb.vercel.app',
      'X-Title': 'Business CEO AI Pazarlamacı',
    },
    body: JSON.stringify(buildOpenRouterRequestBody(model, messages, options)),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !content) {
    throw new Error(data.error?.message || 'OpenRouter geçerli yanıt vermedi.');
  }
  return content;
}

export async function callCompanyMarketingAI(
  accountId: string,
  messages: ChatMessage[],
  options: MarketingAIOptions = {}
): Promise<MarketingAIResult> {
  const credential = await getCompanyMarketingCredential(accountId);
  if (credential) {
    try {
      return {
        content: await callOpenRouter(
          credential.apiKey,
          credential.model,
          messages,
          options
        ),
        provider: 'OPENROUTER',
        model: credential.model,
      };
    } catch (error) {
      console.warn(
        '[Marketing OpenRouter Error]:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  try {
    const response = await callAI(messages, 'marketing');
    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
    };
  } catch {
    return { content: '', provider: 'RULE_ENGINE', model: null };
  }
}

import 'server-only';

import { callAI, type ChatMessage } from '@/lib/ai';

export type MarketingAIResult = {
  content: string;
  // OPENROUTER remains an internal compatibility value for an injected
  // platform provider. Customers never supply or see a provider credential.
  provider: 'OPENROUTER' | 'GROQ' | 'CLOUDFLARE' | 'RULE_ENGINE';
  model: string | null;
};

type MarketingAIOptions = {
  jsonMode?: boolean;
};

/**
 * Marketing requests always use the platform AI router. `accountId` remains in
 * the signature so callers keep tenant context for their own data queries, but
 * it is never used to load a customer-owned provider credential.
 */
export async function callCompanyMarketingAI(
  _accountId: string,
  messages: ChatMessage[],
  _options: MarketingAIOptions = {}
): Promise<MarketingAIResult> {
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

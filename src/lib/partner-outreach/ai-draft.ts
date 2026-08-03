import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PartnerDraftPayload } from './types';

export const partnerDraftSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(10).max(12_000),
  language: z.string().trim().min(2).max(20),
  turkishTranslation: z.string().trim().min(5).max(12_000),
  personalizationEvidence: z
    .array(
      z.object({
        claim: z.string().trim().min(2).max(500),
        sourceId: z.string().trim().min(1).max(160),
        sourceUrl: z.string().url().max(2_000),
      })
    )
    .max(20),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

function jsonPayload(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

export function parsePartnerDraft(
  raw: string,
  allowedSourceIds: Set<string>
): PartnerDraftPayload {
  let value: unknown;
  try {
    value = JSON.parse(jsonPayload(raw));
  } catch {
    throw new Error('Yapay zekâ geçerli e-posta taslağı döndürmedi.');
  }
  const parsed = partnerDraftSchema.parse(value);
  if (
    parsed.personalizationEvidence.some(
      (evidence) => !allowedSourceIds.has(evidence.sourceId)
    )
  ) {
    throw new Error('Taslakta doğrulanmış kaynak dışında bir iddia kullanıldı.');
  }
  return parsed;
}

export function draftContentHash(subject: string, body: string) {
  return createHash('sha256')
    .update(`${subject.trim()}\n\u0000\n${body.trim()}`)
    .digest('hex');
}

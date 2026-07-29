import { z } from 'zod';

import { managerExecutableActionSchema } from './action-schema';

export const managerPlanSchema = z.object({
  reply: z.string().trim().min(1).max(6000),
  actions: z
    .array(
      z.object({
        action: managerExecutableActionSchema,
        reason: z.string().trim().min(1).max(1200),
        confidence: z.number().min(0).max(1),
        riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        containsBindingCommitment: z.boolean().optional(),
      })
    )
    .max(8),
});

export type ManagerPlan = z.infer<typeof managerPlanSchema>;

export function parseManagerPlan(content: string) {
  const fenced =
    content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const firstBrace = fenced.indexOf('{');
  const lastBrace = fenced.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return managerPlanSchema.parse(
      JSON.parse(fenced.slice(firstBrace, lastBrace + 1))
    );
  } catch {
    return null;
  }
}

export function buildUntrustedManagerHistory(
  history: Array<{
    role: string;
    authorType: string | null;
    authorName: string | null;
    content: string;
    createdAt: Date;
  }>
) {
  return [...history]
    .reverse()
    .slice(-10)
    .map((message) => ({
      role: message.role,
      authorType: message.authorType,
      authorName: message.authorName,
      content: message.content.slice(0, 2000),
      createdAt: message.createdAt.toISOString(),
    }));
}

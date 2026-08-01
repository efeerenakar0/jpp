import { z } from 'zod';
import type { WahaSessionStatus } from '@/lib/waha-client';

export const WHATSAPP_DISCONNECT_CONFIRMATION =
  'WHATSAPP_BAGLANTISINI_KES' as const;

export const whatsAppConnectionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare') }).strict(),
  z.object({ action: z.literal('refresh') }).strict(),
  z
    .object({
      action: z.literal('settings'),
      autoReplyEnabled: z.boolean(),
      allowFirstContact: z.boolean(),
      dailyMessageLimit: z.number().int().min(5).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal('disconnect'),
      confirmation: z.literal(WHATSAPP_DISCONNECT_CONFIRMATION),
    })
    .strict(),
]);

export function parseWhatsAppConnectionAction(value: unknown) {
  return whatsAppConnectionActionSchema.safeParse(value);
}

export type WahaRecoveryAction = 'restart' | 'start' | 'none';

export function wahaRecoveryAction(
  status: WahaSessionStatus
): WahaRecoveryAction {
  if (status === 'FAILED') return 'restart';
  if (status === 'STOPPED') return 'start';
  return 'none';
}

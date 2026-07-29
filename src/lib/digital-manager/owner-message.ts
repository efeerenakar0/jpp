import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';
import type { ManagerPrincipal } from '@/lib/general-manager-context';
import { prisma } from '@/lib/prisma';

import { processDigitalManagerMessage } from './manager-chat';

export async function processVerifiedOwnerWhatsAppMessage(input: {
  companyAccountId: string;
  text: string;
  providerMessageId: string;
  fromPhone: string;
}) {
  const account = await prisma.companyAccount.findFirst({
    where: {
      id: input.companyAccountId,
      status: 'ACTIVE',
      workspaceEnabled: true,
    },
  });
  if (!account) {
    throw new Error('Aktif patron hesabı bulunamadı.');
  }
  const manager: ManagerPrincipal = {
    accountId: account.id,
    companyName: account.companyName,
    accountSlug: account.slug,
    type: 'OWNER',
    memberId: null,
    displayName: account.ownerName,
  };
  const result = await processDigitalManagerMessage({
    manager,
    message: input.text,
    clientRequestId: `whatsapp:${input.providerMessageId}`,
    source: 'WHATSAPP',
  });
  if (!result.message) {
    return {
      routedAs: 'OWNER' as const,
      duplicate: true,
      delivery: null,
      actions: result.actions,
    };
  }
  const pendingCount = result.actions.filter(
    (action) => action.status === 'PENDING_APPROVAL'
  ).length;
  const suffix =
    pendingCount > 0
      ? `\n\n${pendingCount} işlem güvenlik nedeniyle panelde onayınızı bekliyor.`
      : '';
  const delivery = await queueCompanyWhatsAppMessage({
    companyAccountId: account.id,
    to: input.fromPhone,
    text: `${result.message.content}${suffix}`.slice(0, 1500),
    recipientType: 'OWNER',
    recipientId: account.id,
    purpose: 'OWNER_COMMAND_RESPONSE',
    correlationId: input.providerMessageId,
    replyToProviderMessageId: input.providerMessageId,
    idempotencyKey: `owner-command:${input.providerMessageId}:response`,
    createdByType: 'DIGITAL_GENERAL_MANAGER',
    createdById: account.id,
  });
  return {
    routedAs: 'OWNER' as const,
    duplicate: result.duplicate,
    delivery,
    actions: result.actions,
  };
}

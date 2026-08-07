import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ default: {} }));

import { pauseConversationAutomationForViewing } from './service';

describe('viewing workflow human handoff', () => {
  it('pauses AI only for the tenant-owned conversation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      customerConversation: { updateMany },
    } as unknown as Prisma.TransactionClient;

    await pauseConversationAutomationForViewing(tx, {
      companyAccountId: 'company-a',
      conversationId: 'conversation-a',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conversation-a',
        companyAccountId: 'company-a',
      },
      data: { aiEnabled: false },
    });
  });

  it('fails closed instead of pausing another tenant conversation', async () => {
    const tx = {
      customerConversation: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      pauseConversationAutomationForViewing(tx, {
        companyAccountId: 'company-a',
        conversationId: 'conversation-from-company-b',
      })
    ).rejects.toThrow('bu şirkette bulunamadı');
  });
});

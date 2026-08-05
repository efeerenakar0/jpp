import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    partnerDiscoveryRun: {
      findFirst: mocks.findRun,
      updateMany: mocks.updateRun,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/marketing-ai', () => ({
  callCompanyMarketingAI: vi.fn(),
}));

import { importPartnerOrganizations } from './service';

describe('partner keşif tenant sınırı', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateRun.mockResolvedValue({ count: 1 });
  });

  it('başka şirkete ait discovery run kimliğine kayıt bağlamaz', async () => {
    mocks.findRun.mockResolvedValue(null);

    await expect(
      importPartnerOrganizations({
        companyAccountId: 'company-a',
        runId: 'company-b-run',
        providerKey: 'manual-csv',
        sourceType: 'MANUAL_CSV',
        candidates: [],
      })
    ).rejects.toThrow(/keşif çalışması/i);

    expect(mocks.findRun).toHaveBeenCalledWith({
      where: { id: 'company-b-run', companyAccountId: 'company-a' },
      select: { id: true },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateRun).not.toHaveBeenCalled();
  });
});

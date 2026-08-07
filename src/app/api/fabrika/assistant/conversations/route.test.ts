import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  conversationUpdateMany: vi.fn(),
}));

const errors = vi.hoisted(() => ({
  SessionError: class SessionError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: errors.SessionError,
  FabrikaForbiddenError: errors.ForbiddenError,
  requireFabrikaPrincipal: vi.fn(),
  requireFabrikaOwner: mocks.requireOwner,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    customerConversation: {
      updateMany: mocks.conversationUpdateMany,
    },
  },
}));

import { DELETE } from './route';

function request(id = 'conversation-a') {
  return new Request(
    `https://app.test/api/fabrika/assistant/conversations?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

describe('DELETE /api/fabrika/assistant/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.conversationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('removes only the requested conversation from the authenticated company', async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(mocks.conversationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'conversation-a',
        companyAccountId: 'company-a',
        isActive: true,
      },
      data: { isActive: false, aiEnabled: false },
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Sohbet silindi.',
    });
  });

  it('does not reveal conversations from another company', async () => {
    mocks.conversationUpdateMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(request());

    expect(response.status).toBe(404);
  });

  it('rejects employee deletion attempts', async () => {
    mocks.requireOwner.mockRejectedValue(new errors.ForbiddenError());

    const response = await DELETE(request());

    expect(response.status).toBe(403);
    expect(mocks.conversationUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects malformed conversation identifiers', async () => {
    const response = await DELETE(request(' '.repeat(4)));

    expect(response.status).toBe(400);
    expect(mocks.requireOwner).not.toHaveBeenCalled();
  });
});

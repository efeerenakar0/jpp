import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  conversationFindFirst: vi.fn(),
  configFindUnique: vi.fn(),
  getProfilePicture: vi.fn(),
  fetchOwnedMediaBytes: vi.fn(),
}));

const errors = vi.hoisted(() => ({
  SessionError: class SessionError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: errors.SessionError,
  FabrikaForbiddenError: errors.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    customerConversation: { findFirst: mocks.conversationFindFirst },
    whatsAppConfig: { findUnique: mocks.configFindUnique },
  },
}));

vi.mock('@/lib/waha-client', () => ({
  getWahaContactProfilePicture: mocks.getProfilePicture,
}));

vi.mock('@/lib/media-storage', () => ({
  fetchOwnedMediaBytes: mocks.fetchOwnedMediaBytes,
}));

import { GET } from './route';

function context(conversationId = 'conversation-a') {
  return { params: Promise.resolve({ conversationId }) };
}

describe('GET /api/fabrika/assistant/conversations/[conversationId]/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
    });
    mocks.conversationFindFirst.mockResolvedValue({
      customerPhone: '+905321234567',
    });
    mocks.configFindUnique.mockResolvedValue({
      connectionStatus: 'CONNECTED',
      evolutionInstanceName: 'jasmine-company-a',
    });
    mocks.getProfilePicture.mockResolvedValue(
      'https://pps.whatsapp.net/profile.jpg'
    );
    mocks.fetchOwnedMediaBytes.mockResolvedValue({
      bytes: Buffer.from([1, 2, 3]),
      mimeType: 'image/jpeg',
    });
  });

  it('proxies the real profile image only for the authenticated company conversation', async () => {
    const response = await GET(new Request('https://app.test/avatar'), context());

    expect(mocks.conversationFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'conversation-a',
        companyAccountId: 'company-a',
        channel: 'WHATSAPP',
        isActive: true,
      },
      select: { customerPhone: true },
    });
    expect(mocks.getProfilePicture).toHaveBeenCalledWith({
      sessionName: 'jasmine-company-a',
      contactId: '+905321234567',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      Uint8Array.from([1, 2, 3])
    );
  });

  it('does not reveal a conversation belonging to another company', async () => {
    mocks.conversationFindFirst.mockResolvedValue(null);

    const response = await GET(new Request('https://app.test/avatar'), context());

    expect(response.status).toBe(404);
    expect(mocks.configFindUnique).not.toHaveBeenCalled();
    expect(mocks.getProfilePicture).not.toHaveBeenCalled();
  });

  it('falls back cleanly when WhatsApp is disconnected or the photo is private', async () => {
    mocks.configFindUnique.mockResolvedValue({
      connectionStatus: 'DISCONNECTED',
      evolutionInstanceName: 'jasmine-company-a',
    });

    const disconnected = await GET(
      new Request('https://app.test/avatar'),
      context()
    );
    expect(disconnected.status).toBe(404);

    mocks.configFindUnique.mockResolvedValue({
      connectionStatus: 'CONNECTED',
      evolutionInstanceName: 'jasmine-company-a',
    });
    mocks.getProfilePicture.mockResolvedValue(null);
    const privatePhoto = await GET(
      new Request('https://app.test/avatar'),
      context()
    );
    expect(privatePhoto.status).toBe(404);
    expect(mocks.fetchOwnedMediaBytes).not.toHaveBeenCalled();
  });
});

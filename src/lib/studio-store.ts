// Shared in-memory store for Studio uploaded photos and processed filters

interface StudioSession {
  shootId: string;
  device: string;
  websiteUrl: string;
  textColor: string;
  logoBase64: string | null;
  logoMime: string | null;
  photos: Array<{
    name: string;
    buffer: Buffer;
  }>;
  processed: Record<string, {
    hdrPhotos: Array<{ name: string; buffer: Buffer }>;
    watermarkedPhotos: Array<{ name: string; buffer: Buffer }>;
  }>;
}

// Global variable survives across warm Lambda calls in Node.js runtime
const globalStudioStore = globalThis as unknown as {
  __studioSessions: Record<string, StudioSession>;
};

if (!globalStudioStore.__studioSessions) {
  globalStudioStore.__studioSessions = {};
}

export const studioSessions = globalStudioStore.__studioSessions;

export function getOrCreateSession(shootId: string): StudioSession {
  if (!studioSessions[shootId]) {
    studioSessions[shootId] = {
      shootId,
      device: 'iPhone 15 Pro',
      websiteUrl: 'www.jasminegroup.com',
      textColor: '#ffffff',
      logoBase64: null,
      logoMime: null,
      photos: [],
      processed: {}
    };
  }
  return studioSessions[shootId];
}

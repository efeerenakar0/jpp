import 'server-only';

import {
  StabilityUltraError,
  generateWithStableImageUltra,
  type StabilityUltraErrorCode,
  type StabilityUltraGenerationInput,
  type StabilityUltraGenerationResult,
} from './stability-ultra';

export type StudioImageProvider = {
  id: string;
  model: string;
  generate(
    input: StabilityUltraGenerationInput
  ): Promise<StabilityUltraGenerationResult>;
};

export type StudioPosterBackgroundResult = {
  buffer: Buffer;
  mimeType: string;
  source: 'provider' | 'canvas-fallback';
  provider: string;
  model: string;
  fallbackUsed: boolean;
  fallbackCode?: StabilityUltraErrorCode;
};

const stabilityUltraProvider: StudioImageProvider = {
  id: 'stability',
  model: 'Stable Image Ultra',
  generate: generateWithStableImageUltra,
};

function configuredStudioImageProvider(): StudioImageProvider {
  const provider =
    process.env.STUDIO_IMAGE_PROVIDER?.trim().toLowerCase() || 'stability';
  if (provider === 'stability') {
    return stabilityUltraProvider;
  }
  throw new Error('Unsupported studio image provider');
}

export async function generateStudioPosterBackground(
  input: StabilityUltraGenerationInput,
  provider?: StudioImageProvider
): Promise<StudioPosterBackgroundResult> {
  let activeProvider = provider;
  try {
    activeProvider ||= configuredStudioImageProvider();
    const generated = await activeProvider.generate(input);
    return {
      buffer: generated.buffer,
      mimeType: generated.mimeType,
      source: 'provider',
      provider: activeProvider.id,
      model: activeProvider.model,
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      buffer: input.image,
      mimeType: input.mimeType,
      source: 'canvas-fallback',
      provider: activeProvider?.id || 'unavailable',
      model: activeProvider?.model || 'Configured image provider',
      fallbackUsed: true,
      fallbackCode:
        error instanceof StabilityUltraError
          ? error.code
          : 'PROVIDER_UNAVAILABLE',
    };
  }
}

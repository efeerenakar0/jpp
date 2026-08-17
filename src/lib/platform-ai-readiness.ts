type PlatformEnvironment = Partial<Record<string, string | undefined>>;

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isPlatformTextAiReady(
  environment: PlatformEnvironment = process.env
) {
  return Boolean(
    hasValue(environment.OPENROUTER_API_KEY) ||
      hasValue(environment.GROQ_API_KEY) ||
      (hasValue(environment.CLOUDFLARE_API_TOKEN) &&
        hasValue(environment.CLOUDFLARE_ACCOUNT_ID))
  );
}

export function isPlatformStudioAiReady(
  environment: PlatformEnvironment = process.env
) {
  return hasValue(environment.STABILITY_API_KEY);
}

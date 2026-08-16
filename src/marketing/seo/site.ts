const fallbackSiteOrigin = "https://businessceo.ai";

export function resolveSiteOrigin(): URL {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredOrigin) {
    return new URL(fallbackSiteOrigin);
  }

  try {
    const parsed = new URL(configuredOrigin);

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return new URL(fallbackSiteOrigin);
    }

    return parsed;
  } catch {
    return new URL(fallbackSiteOrigin);
  }
}

export const siteOrigin = resolveSiteOrigin();

export function absoluteSiteUrl(pathname: string): string {
  return new URL(pathname, siteOrigin).toString();
}

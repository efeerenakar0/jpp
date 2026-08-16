import {
  IntegrationUnavailableError,
  type IntegrationUnavailableReason,
} from "./shared";

export interface LoginDestinationProvider {
  getLoginUrl(): string;
}

function assertSafeLoginUrl(loginUrl: string): string {
  const value = loginUrl.trim();

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("The login destination must be a relative path or HTTPS URL.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new TypeError("The login destination must be a relative path or HTTPS URL.");
  }

  return parsed.toString();
}

export function createLoginDestinationProvider(
  loginUrl: string,
): LoginDestinationProvider {
  const safeLoginUrl = assertSafeLoginUrl(loginUrl);

  return Object.freeze({
    getLoginUrl: () => safeLoginUrl,
  });
}

export function createUnavailableLoginDestinationProvider(
  reason: IntegrationUnavailableReason = "not_configured",
): LoginDestinationProvider {
  return Object.freeze({
    getLoginUrl: () => {
      throw new IntegrationUnavailableError("login", reason);
    },
  });
}

/**
 * Safe standalone default. Consumers must deliberately configure a destination
 * before rendering or following a login link.
 */
export const unavailableLoginDestinationProvider =
  createUnavailableLoginDestinationProvider();

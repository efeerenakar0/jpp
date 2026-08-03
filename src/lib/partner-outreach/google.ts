import 'server-only';

import { decryptPartnerCredential, encryptPartnerCredential } from './crypto';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function googleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function partnerGmailConfigured() {
  return Boolean(googleConfig() && process.env.PARTNER_CREDENTIAL_ENCRYPTION_KEY?.trim());
}

export function buildPartnerGoogleAuthorizationUrl(state: string) {
  const config = googleConfig();
  if (!config) throw new Error('Merkezi Gmail bağlantısı henüz yapılandırılmamış.');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', `openid email ${GMAIL_SEND_SCOPE}`);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'false');
  url.searchParams.set('state', state);
  return url.toString();
}

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const value = (await response.json()) as GoogleTokenResponse & { error_description?: string };
  if (!response.ok || !value.access_token) throw new Error(value.error_description || 'Google bağlantısı tamamlanamadı.');
  return value;
}

export async function exchangePartnerGoogleCode(code: string) {
  const config = googleConfig();
  if (!config) throw new Error('Merkezi Gmail bağlantısı yapılandırılmamış.');
  return tokenRequest(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  }));
}

export async function refreshPartnerGoogleAccessToken(encryptedRefreshToken: string) {
  const config = googleConfig();
  if (!config) throw new Error('Merkezi Gmail bağlantısı yapılandırılmamış.');
  return tokenRequest(new URLSearchParams({
    refresh_token: decryptPartnerCredential(encryptedRefreshToken),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  }));
}

export async function getPartnerGoogleEmail(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  const value = (await response.json()) as { email?: string; email_verified?: boolean };
  if (!response.ok || !value.email || value.email_verified === false) throw new Error('Google hesabının e-posta adresi doğrulanamadı.');
  return value.email.toLowerCase();
}

export function encryptedGoogleTokens(token: GoogleTokenResponse) {
  if (!token.refresh_token) throw new Error('Google kalıcı gönderim izni vermedi. Bağlantıyı yeniden deneyin.');
  const scopes = token.scope.split(/\s+/).filter(Boolean);
  if (!scopes.includes(GMAIL_SEND_SCOPE)) throw new Error('Gmail gönderim izni alınamadı.');
  return {
    encryptedRefreshToken: encryptPartnerCredential(token.refresh_token),
    encryptedAccessToken: encryptPartnerCredential(token.access_token),
    accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000 - 60_000),
    grantedScopes: scopes,
  };
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export function buildGmailRawMessage(input: { to: string; from: string; subject: string; body: string }) {
  const normalizedBody = input.body.replace(/\r?\n/g, '\r\n');
  return Buffer.from([
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedBody,
  ].join('\r\n')).toString('base64url');
}

export async function sendPartnerGmail(input: { accessToken: string; to: string; from: string; subject: string; body: string }) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: buildGmailRawMessage(input) }),
    signal: AbortSignal.timeout(20_000),
  });
  const value = (await response.json()) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!response.ok || !value.id) {
    const error = new Error(value.error?.message || 'Gmail gönderimi başarısız oldu.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return { providerMessageId: value.id, providerThreadId: value.threadId || null };
}

export async function revokePartnerGoogleToken(encryptedRefreshToken: string) {
  const token = decryptPartnerCredential(encryptedRefreshToken);
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

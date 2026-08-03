import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { buildPartnerGoogleAuthorizationUrl, partnerGmailConfigured } from '@/lib/partner-outreach/google';
import { createPartnerOAuthState } from '@/lib/partner-outreach/oauth-state';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const principal = await requireFabrikaOwner();
    if (!partnerGmailConfigured()) throw new Error('Merkezi Gmail bağlantısı henüz sistem yöneticisi tarafından yapılandırılmamış.');
    const csrfToken = randomBytes(24).toString('base64url');
    const state = createPartnerOAuthState({ accountId: principal.account.id, principalId: principal.account.id, csrfToken });
    const response = NextResponse.json({ success: true, authorizationUrl: buildPartnerGoogleAuthorizationUrl(state) });
    response.cookies.set('partner_oauth_csrf', csrfToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/fabrika/partners/google', maxAge: 10 * 60 });
    return response;
  } catch (error) { return partnerApiError(error); }
}

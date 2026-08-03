import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FabrikaForbiddenError, FabrikaSessionError, requireFabrikaOwner } from '@/lib/fabrika-session';
import { encryptedGoogleTokens, exchangePartnerGoogleCode, getPartnerGoogleEmail } from '@/lib/partner-outreach/google';
import { readPartnerOAuthState } from '@/lib/partner-outreach/oauth-state';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL('/fabrika/partnerler', url.origin);
  try {
    const principal = await requireFabrikaOwner();
    if (url.searchParams.get('error')) { target.searchParams.set('gmail', 'denied'); return NextResponse.redirect(target); }
    const state = readPartnerOAuthState(url.searchParams.get('state'));
    const csrf = (await cookies()).get('partner_oauth_csrf')?.value;
    const code = url.searchParams.get('code');
    if (!state || !csrf || state.csrfToken !== csrf || !code || state.accountId !== principal.account.id || state.principalId !== principal.account.id) {
      target.searchParams.set('gmail', 'invalid-state');
      return NextResponse.redirect(target);
    }
    const token = await exchangePartnerGoogleCode(code);
    const email = await getPartnerGoogleEmail(token.access_token);
    const encrypted = encryptedGoogleTokens(token);
    await prisma.partnerMailboxConnection.upsert({
      where: { companyAccountId: principal.account.id },
      create: { companyAccountId: principal.account.id, email, connectedById: principal.account.id, ...encrypted },
      update: { email, connectedById: principal.account.id, status: 'CONNECTED', revokedAt: null, lastErrorCode: null, ...encrypted },
    });
    const response = NextResponse.redirect(new URL('/fabrika/partnerler?gmail=connected', url.origin));
    response.cookies.delete('partner_oauth_csrf');
    return response;
  } catch (error) {
    if (error instanceof FabrikaSessionError || error instanceof FabrikaForbiddenError) return NextResponse.redirect(new URL('/fabrika-giris', url.origin));
    console.error('Partner Gmail callback failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    target.searchParams.set('gmail', 'error');
    return NextResponse.redirect(target);
  }
}

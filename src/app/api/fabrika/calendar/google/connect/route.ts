import { NextResponse } from 'next/server';
import { createCalendarOAuthState } from '@/lib/calendar-crypto';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import {
  buildGoogleCalendarAuthorizationUrl,
  googleCalendarConfigured,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const origin = new URL(request.url).origin;
    if (!googleCalendarConfigured()) {
      return NextResponse.redirect(
        new URL('/fabrika/takvim?google=not-configured', origin)
      );
    }
    const state = createCalendarOAuthState({
      accountId: principal.account.id,
      principalId: principal.account.id,
    });
    return NextResponse.redirect(
      buildGoogleCalendarAuthorizationUrl({ origin, state })
    );
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) {
      return NextResponse.redirect(
        new URL('/fabrika-giris', new URL(request.url).origin)
      );
    }
    console.error('Google Calendar connect error:', error);
    return NextResponse.redirect(
      new URL('/fabrika/takvim?google=error', new URL(request.url).origin)
    );
  }
}

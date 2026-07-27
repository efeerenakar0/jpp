import { NextResponse } from 'next/server';
import { readCalendarOAuthState } from '@/lib/calendar-crypto';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import {
  exchangeGoogleCalendarCode,
  getGoogleAccountEmail,
  saveGoogleCalendarConnection,
  syncCompanyGoogleCalendar,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL('/fabrika/takvim', url.origin);
  try {
    const principal = await requireFabrikaOwner();
    if (url.searchParams.get('error')) {
      target.searchParams.set('google', 'denied');
      return NextResponse.redirect(target);
    }
    const state = readCalendarOAuthState(url.searchParams.get('state'));
    const code = url.searchParams.get('code');
    if (
      !state ||
      !code ||
      state.accountId !== principal.account.id ||
      state.principalId !== principal.account.id
    ) {
      target.searchParams.set('google', 'invalid-state');
      return NextResponse.redirect(target);
    }
    const token = await exchangeGoogleCalendarCode({
      code,
      origin: url.origin,
    });
    const email = await getGoogleAccountEmail(token.access_token!);
    await saveGoogleCalendarConnection({
      companyAccountId: principal.account.id,
      email,
      token,
    });
    try {
      await syncCompanyGoogleCalendar(principal.account.id);
    } catch {
      // Bağlantı saklandı; kullanıcı takvimden senkronu tekrar deneyebilir.
    }
    target.searchParams.set('google', 'connected');
    return NextResponse.redirect(target);
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) {
      return NextResponse.redirect(new URL('/fabrika-giris', url.origin));
    }
    console.error('Google Calendar callback error:', error);
    target.searchParams.set('google', 'error');
    return NextResponse.redirect(target);
  }
}

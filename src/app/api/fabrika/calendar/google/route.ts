import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import {
  disconnectGoogleCalendar,
  listGoogleCalendars,
  selectGoogleCalendar,
  syncCompanyGoogleCalendar,
} from '@/lib/google-calendar';

const selectionSchema = z.object({
  calendarId: z.string().trim().min(1).max(1024),
});

function authError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json(
      { success: false, error: 'Fabrika oturumu gerekli.' },
      { status: 401 }
    );
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const calendars = await listGoogleCalendars(principal.account.id);
    return NextResponse.json({ success: true, calendars });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('Google Calendar list error:', error);
    return NextResponse.json(
      { success: false, error: 'Google takvimleri şu anda alınamadı.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = selectionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir Google takvimi seçin.' },
        { status: 400 }
      );
    }
    const calendar = await selectGoogleCalendar(
      principal.account.id,
      parsed.data.calendarId
    );
    const sync = await syncCompanyGoogleCalendar(principal.account.id);
    return NextResponse.json({ success: true, calendar, sync });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('Google Calendar selection error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Google takvimi seçilemedi.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const principal = await requireFabrikaOwner();
    await disconnectGoogleCalendar(principal.account.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('Google Calendar disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Google Calendar bağlantısı kaldırılamadı.' },
      { status: 500 }
    );
  }
}

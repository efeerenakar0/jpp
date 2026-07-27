import { NextResponse } from 'next/server';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { disconnectGoogleCalendar } from '@/lib/google-calendar';

export async function DELETE() {
  try {
    const principal = await requireFabrikaOwner();
    await disconnectGoogleCalendar(principal.account.id);
    return NextResponse.json({ success: true });
  } catch (error) {
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
    console.error('Google Calendar disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Google Calendar bağlantısı kaldırılamadı.' },
      { status: 500 }
    );
  }
}

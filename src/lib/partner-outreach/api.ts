import { NextResponse } from 'next/server';
import { FabrikaForbiddenError, FabrikaSessionError } from '@/lib/fabrika-session';

export function partnerApiError(error: unknown) {
  if (error instanceof FabrikaSessionError) return NextResponse.json({ success: false, error: 'Fabrika oturumu gerekli.' }, { status: 401 });
  if (error instanceof FabrikaForbiddenError) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
  const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  const safe = /anahtar|token|secret|credential|şifre/i.test(message)
    ? 'Partner servisi güvenli biçimde yapılandırılamadı.'
    : message;
  return NextResponse.json({ success: false, error: safe }, { status: 400 });
}

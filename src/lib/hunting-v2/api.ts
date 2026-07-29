import 'server-only';

import { NextResponse } from 'next/server';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
} from '@/lib/fabrika-session';
import { HuntingRateLimitError } from './rate-limit';

export function huntingApiError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof HuntingRateLimitError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      }
    );
  }
  if (error instanceof Error) {
    const status =
      error.name === 'ZodError'
        ? 400
        : error.message.includes('bulunamadı')
          ? 404
          : error.message.includes('yetki') ||
              error.message.includes('izinli değil') ||
              error.message.includes('kapalı')
            ? 403
            : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(
    { error: 'Avcı işlemi tamamlanamadı.' },
    { status: 500 }
  );
}

export function principalActor(principal: {
  type: 'OWNER' | 'EMPLOYEE';
  account: { id: string };
  member: { id: string } | null;
}) {
  return {
    type: principal.type,
    id: principal.member?.id || principal.account.id,
    key: `${principal.type}:${principal.member?.id || principal.account.id}`,
  };
}

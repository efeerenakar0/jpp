import { NextResponse } from 'next/server';

import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

function errorResponse(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json(
    { error: 'Telefon ayarı güncellenemedi.' },
    { status: 500 }
  );
}

export async function POST() {
  try {
    await requireFabrikaOwner();
    return NextResponse.json(
      {
        error:
          'Telefon doğrulaması kullanılmıyor. Telefon numarasını kaydetmeniz yeterli.',
      },
      { status: 410 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

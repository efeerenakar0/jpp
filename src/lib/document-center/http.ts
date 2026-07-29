import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
} from '@/lib/fabrika-session';
import { DocumentCenterError } from './repository';

export function documentCenterHttpError(error: unknown) {
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
  if (error instanceof DocumentCenterError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Gönderilen belge verisi geçersiz.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  console.error('Document Center request failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown failure',
  });
  return NextResponse.json(
    { success: false, error: 'Belge Merkezi işlemi tamamlanamadı.' },
    { status: 500 }
  );
}

import { NextResponse } from 'next/server';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
} from '@/lib/fabrika-session';
import { MediaValidationError } from '@/lib/media-storage';
import { PropertyMediaError } from '@/lib/property-media';
import { StabilityUltraError } from '@/lib/stability-ultra';

export function propertyMediaHttpError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json(
      { success: false, error: 'Bu işlem için Fabrika oturumu gerekli.' },
      { status: 401 }
    );
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 403 }
    );
  }
  if (
    error instanceof PropertyMediaError ||
    error instanceof MediaValidationError
  ) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 'status' in error ? error.status : 400 }
    );
  }
  if (error instanceof StabilityUltraError) {
    return NextResponse.json(
      { success: false, code: error.code, error: error.message },
      { status: error.status }
    );
  }
  console.error('Property media request failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown failure',
  });
  return NextResponse.json(
    {
      success: false,
      error: 'Medya işlemi tamamlanamadı. Lütfen yeniden deneyin.',
    },
    { status: 500 }
  );
}

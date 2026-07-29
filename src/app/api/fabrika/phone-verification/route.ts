import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  confirmPhoneVerification,
  PhoneVerificationError,
  requestPhoneVerification,
} from '@/lib/digital-manager/phone-verification';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

const requestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('request'),
      subjectType: z.enum(['OWNER', 'MEMBER']),
      memberId: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('confirm'),
      challengeId: z.string().uuid(),
      code: z.string().regex(/^\d{6}$/, 'Kod 6 haneli olmalı.'),
    })
    .strict(),
]);

function errorResponse(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PhoneVerificationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  console.error('[Phone Verification Error]:', error);
  return NextResponse.json(
    { error: 'Telefon doğrulama işlemi tamamlanamadı.' },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            'Doğrulama isteği geçersiz.',
        },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'request') {
      if (
        parsed.data.subjectType === 'MEMBER' &&
        !parsed.data.memberId
      ) {
        return NextResponse.json(
          { error: 'Doğrulanacak çalışanı seçin.' },
          { status: 400 }
        );
      }
      const result = await requestPhoneVerification({
        companyAccountId: principal.account.id,
        subjectType: parsed.data.subjectType,
        subjectId:
          parsed.data.subjectType === 'OWNER'
            ? principal.account.id
            : parsed.data.memberId!,
        createdByType: 'OWNER',
        createdById: principal.account.id,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const result = await confirmPhoneVerification({
      companyAccountId: principal.account.id,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
      actorType: 'OWNER',
      actorId: principal.account.id,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

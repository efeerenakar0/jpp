import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { processViewingPanelDecision } from '@/lib/viewing-workflow/service';

export const dynamic = 'force-dynamic';

const decisionSchema = z
  .object({
    promptId: z.string().min(1),
    action: z.enum([
      'REASSIGN',
      'WAIT',
      'CANCEL',
      'REMOVE',
      'KEEP',
      'DETAIL',
    ]),
    candidateIndex: z.number().int().positive().max(100).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
    clientRequestId: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'REASSIGN' && !value.candidateIndex) {
      context.addIssue({
        code: 'custom',
        path: ['candidateIndex'],
        message: 'Atanacak çalışan seçilmelidir.',
      });
    }
  });

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || 'Gösterim kararı geçersiz.',
        },
        { status: 400 }
      );
    }
    const result = await processViewingPanelDecision({
      companyAccountId: principal.account.id,
      ownerId: principal.account.id,
      promptId: parsed.data.promptId,
      action: parsed.data.action,
      candidateIndex: parsed.data.candidateIndex,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.clientRequestId,
    });
    if (result.mutated) {
      return NextResponse.json({ success: true, result });
    }
    if ('duplicate' in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, result });
    }
    if ('stale' in result && result.stale) {
      return NextResponse.json(
        { error: 'Bu karar daha önce işlendi veya artık açık değil.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Karar bu gösterim adımıyla uyumlu değil.' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : 'Gösterim kararı uygulanamadı.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

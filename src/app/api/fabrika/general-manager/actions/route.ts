import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decideManagerAction } from '@/lib/digital-manager/executor';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

const decisionSchema = z.object({
  actionId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(1000).nullable().optional(),
  editedPayload: z.unknown().optional(),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || 'Onay kararı geçersiz.',
        },
        { status: 400 }
      );
    }
    const action = await decideManagerAction({
      companyAccountId: principal.account.id,
      actionId: parsed.data.actionId,
      decision: parsed.data.decision,
      ownerId: principal.account.id,
      reason: parsed.data.reason,
      editedPayload: parsed.data.editedPayload,
    });
    return NextResponse.json({ success: true, action });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : 'Aksiyon sonuçlandırılamadı.';
    const status = /bulunamadı|bekleyen/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

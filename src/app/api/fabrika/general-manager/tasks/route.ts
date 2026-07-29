import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  decideManagerAction,
  proposeManagerAction,
} from '@/lib/digital-manager/executor';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { prisma } from '@/lib/prisma';

const reassignSchema = z
  .object({
    taskId: z.string().min(1),
    memberId: z.string().min(1),
    reason: z.string().trim().min(2).max(1000),
    clientRequestId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = reassignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || 'Yeniden atama isteği geçersiz.',
        },
        { status: 400 }
      );
    }
    const [task, member] = await Promise.all([
      prisma.crmTask.findFirst({
        where: {
          id: parsed.data.taskId,
          companyAccountId: principal.account.id,
        },
        select: { id: true, title: true, assignedMemberId: true },
      }),
      prisma.companyMember.findFirst({
        where: {
          id: parsed.data.memberId,
          companyAccountId: principal.account.id,
          active: true,
        },
        select: { id: true, name: true },
      }),
    ]);
    if (!task) throw new Error('Görev bu şirket hesabında bulunamadı.');
    if (!member) throw new Error('Aktif ekip üyesi bulunamadı.');
    if (task.assignedMemberId === member.id) {
      throw new Error('Görev zaten bu çalışana atanmış.');
    }
    const action = await proposeManagerAction({
      companyAccountId: principal.account.id,
      action: {
        actionType: 'REASSIGN_EMPLOYEE',
        taskId: task.id,
        employeeId: member.id,
        reason: parsed.data.reason,
      },
      reason: `${task.title} görevi patron tarafından ${member.name} çalışanına yeniden atanıyor.`,
      evidence: {
        source: 'DIGITAL_MANAGER_DASHBOARD',
        taskId: task.id,
        previousMemberId: task.assignedMemberId,
        nextMemberId: member.id,
      },
      confidence: 1,
      riskLevel: 'MEDIUM',
      requestedByType: 'OWNER',
      requestedById: principal.account.id,
      idempotencyKey: `owner-reassign:${parsed.data.clientRequestId}`,
    });
    const finalized =
      action.status === 'PENDING_APPROVAL'
        ? await decideManagerAction({
            companyAccountId: principal.account.id,
            actionId: action.id,
            decision: 'APPROVED',
            ownerId: principal.account.id,
            reason: parsed.data.reason,
          })
        : action;
    return NextResponse.json({ success: true, action: finalized });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : 'Görev yeniden atanamadı.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

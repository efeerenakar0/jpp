import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appendManagerAudit, recordOperationEvent } from '@/lib/digital-manager/events';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { prisma } from '@/lib/prisma';

const handoffSchema = z.object({
  handoffId: z.string().min(1),
  action: z.enum(['ACCEPT', 'RETURN']),
  memberId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = handoffSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Devir işlemi geçersiz.' },
        { status: 400 }
      );
    }
    const requestedMemberId =
      principal.type === 'EMPLOYEE'
        ? principal.member.id
        : parsed.data.memberId || null;
    const result = await prisma.$transaction(async (tx) => {
      const handoff = await tx.conversationHandoff.findFirst({
        where: {
          id: parsed.data.handoffId,
          companyAccountId: principal.account.id,
        },
      });
      if (!handoff) throw new Error('Sohbet devri bulunamadı.');
      if (
        principal.type === 'EMPLOYEE' &&
        handoff.assignedMemberId &&
        handoff.assignedMemberId !== principal.member.id
      ) {
        throw new Error('Bu sohbet başka bir çalışana atanmış.');
      }
      if (requestedMemberId) {
        const member = await tx.companyMember.findFirst({
          where: {
            id: requestedMemberId,
            companyAccountId: principal.account.id,
            active: true,
          },
          select: { id: true },
        });
        if (!member) throw new Error('Aktif ekip üyesi bulunamadı.');
      }
      const accepting = parsed.data.action === 'ACCEPT';
      const changed = await tx.conversationHandoff.updateMany({
        where: {
          id: handoff.id,
          companyAccountId: principal.account.id,
          status: accepting
            ? { in: ['PROPOSED', 'REQUESTED', 'ACCEPTED'] }
            : 'ACTIVE',
          ...(accepting &&
          principal.type === 'EMPLOYEE' &&
          handoff.assignedMemberId
            ? { assignedMemberId: principal.member.id }
            : {}),
        },
        data: accepting
          ? {
              status: 'ACTIVE',
              assignedMemberId: requestedMemberId,
              acceptedAt: new Date(),
            }
          : {
              status: 'RETURNED',
              returnedAt: new Date(),
            },
      });
      if (changed.count !== 1) {
        throw new Error(
          accepting
            ? 'Sohbet başka bir kullanıcı tarafından devralındı.'
            : 'Yalnız aktif bir sohbet asistana geri verilebilir.'
        );
      }
      await tx.customerConversation.update({
        where: { id: handoff.conversationId },
        data: { aiEnabled: !accepting },
      });
      if (accepting) {
        await recordOperationEvent(
          {
            companyAccountId: principal.account.id,
            eventType: 'HANDOFF_ACCEPTED',
            entityType: 'CUSTOMER_CONVERSATION',
            entityId: handoff.conversationId,
            actorType: principal.type,
            actorId:
              principal.type === 'OWNER'
                ? principal.account.id
                : principal.member.id,
            conversationId: handoff.conversationId,
            idempotencyKey: `handoff:${handoff.id}:accepted`,
          },
          tx
        );
      }
      await appendManagerAudit(
        {
          companyAccountId: principal.account.id,
          managerActionId: handoff.managerActionId,
          actorType: principal.type,
          actorId:
            principal.type === 'OWNER'
              ? principal.account.id
              : principal.member.id,
          operation: accepting ? 'ACCEPT_HANDOFF' : 'RETURN_HANDOFF',
          entityType: 'CUSTOMER_CONVERSATION',
          entityId: handoff.conversationId,
          result: accepting ? 'ACTIVE' : 'RETURNED',
          completedAt: new Date(),
        },
        tx
      );
      return tx.conversationHandoff.findFirstOrThrow({
        where: {
          id: handoff.id,
          companyAccountId: principal.account.id,
        },
      });
    });
    return NextResponse.json({ success: true, handoff: result });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : 'Sohbet devri tamamlanamadı.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

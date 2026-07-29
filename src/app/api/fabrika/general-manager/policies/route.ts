import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decideManagerAction } from '@/lib/digital-manager/executor';
import { appendManagerAudit } from '@/lib/digital-manager/events';
import { canCreatePermanentAutoApproval } from '@/lib/digital-manager/manager-policy';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { prisma } from '@/lib/prisma';

const requestSchema = z
  .object({
    actionId: z.string().min(1),
    operation: z.enum(['MUTE_EVENT', 'MAKE_PERMANENT']),
  })
  .strict();

function errorResponse(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const message =
    error instanceof Error ? error.message : 'Yönetim kuralı kaydedilemedi.';
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Kural isteği geçersiz.' },
        { status: 400 }
      );
    }
    const sourceAction = await prisma.generalManagerAction.findFirst({
      where: {
        id: parsed.data.actionId,
        companyAccountId: principal.account.id,
      },
      select: {
        id: true,
        actionType: true,
        riskLevel: true,
        operationEventId: true,
        status: true,
      },
    });
    if (!sourceAction) throw new Error('Kaynak aksiyon bulunamadı.');

    if (parsed.data.operation === 'MUTE_EVENT') {
      if (!sourceAction.operationEventId) {
        throw new Error('Bu aksiyon sessize alınabilecek bir olaya bağlı değil.');
      }
      const policy = await prisma.$transaction(async (tx) => {
        const existing = await tx.managerPolicy.findFirst({
          where: {
            companyAccountId: principal.account.id,
            status: 'ACTIVE',
            ruleType: 'MUTE_OPERATION_EVENT',
            sourceActionId: sourceAction.id,
          },
        });
        const stored =
          existing ||
          (await tx.managerPolicy.create({
            data: {
              companyAccountId: principal.account.id,
              scope: 'ONE_TIME',
              ruleType: 'MUTE_OPERATION_EVENT',
              rulePayload: {
                operationEventId: sourceAction.operationEventId,
              },
              sourceActionId: sourceAction.id,
              createdByType: 'OWNER',
              createdById: principal.account.id,
            },
          }));
        await appendManagerAudit(
          {
            companyAccountId: principal.account.id,
            operationEventId: sourceAction.operationEventId,
            managerActionId: sourceAction.id,
            actorType: 'OWNER',
            actorId: principal.account.id,
            operation: 'MUTE_OPERATION_EVENT',
            entityType: 'OPERATION_EVENT',
            entityId: sourceAction.operationEventId,
            result: 'MUTED',
            completedAt: new Date(),
          },
          tx
        );
        return stored;
      });
      if (sourceAction.status === 'PENDING_APPROVAL') {
        await decideManagerAction({
          companyAccountId: principal.account.id,
          actionId: sourceAction.id,
          decision: 'REJECTED',
          ownerId: principal.account.id,
          reason: 'Patron bu olayı sessize aldı.',
        });
      }
      return NextResponse.json({ success: true, policy });
    }

    if (
      !canCreatePermanentAutoApproval({
        actionType: sourceAction.actionType,
        riskLevel: sourceAction.riskLevel,
      })
    ) {
      throw new Error(
        'Bu aksiyon yüksek riskli veya dış iletişim içeriyor; kalıcı otomatik kurala çevrilemez.'
      );
    }
    const policy = await prisma.$transaction(async (tx) => {
      const existing = await tx.managerPolicy.findFirst({
        where: {
          companyAccountId: principal.account.id,
          status: 'ACTIVE',
          scope: 'PERMANENT',
          ruleType: 'AUTO_APPROVE_ACTION_TYPE',
          rulePayload: {
            equals: { actionType: sourceAction.actionType },
          },
        },
      });
      const stored =
        existing ||
        (await tx.managerPolicy.create({
          data: {
            companyAccountId: principal.account.id,
            scope: 'PERMANENT',
            ruleType: 'AUTO_APPROVE_ACTION_TYPE',
            rulePayload: { actionType: sourceAction.actionType },
            sourceActionId: sourceAction.id,
            createdByType: 'OWNER',
            createdById: principal.account.id,
          },
        }));
      await appendManagerAudit(
        {
          companyAccountId: principal.account.id,
          managerActionId: sourceAction.id,
          actorType: 'OWNER',
          actorId: principal.account.id,
          operation: 'CREATE_PERMANENT_MANAGER_RULE',
          entityType: 'ACTION_TYPE',
          entityId: sourceAction.actionType,
          result: 'ACTIVE',
          completedAt: new Date(),
        },
        tx
      );
      return stored;
    });
    if (sourceAction.status === 'PENDING_APPROVAL') {
      await decideManagerAction({
        companyAccountId: principal.account.id,
        actionId: sourceAction.id,
        decision: 'APPROVED',
        ownerId: principal.account.id,
        reason: 'Patron düşük riskli aksiyon türünü kalıcı kurala çevirdi.',
      });
    }
    return NextResponse.json({ success: true, policy });
  } catch (error) {
    return errorResponse(error);
  }
}

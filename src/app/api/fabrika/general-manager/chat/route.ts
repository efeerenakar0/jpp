import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { sharedAssistantAIStatus } from '@/lib/ai';
import { processDigitalManagerMessage } from '@/lib/digital-manager/manager-chat';
import {
  generalManagerSuggestions,
  getGeneralManagerContext,
  publicGeneralManagerContext,
  type ManagerPrincipal,
} from '@/lib/general-manager-context';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { prisma } from '@/lib/prisma';

const messageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Mesaj boş olamaz.')
    .max(2000, 'Mesaj en fazla 2.000 karakter olabilir.'),
  clientRequestId: z.string().trim().min(8).max(120).optional(),
});

function managerPrincipal(
  principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>
): ManagerPrincipal {
  return {
    accountId: principal.account.id,
    companyName: principal.account.companyName,
    accountSlug: principal.account.slug,
    type: principal.type,
    memberId: principal.member?.id || null,
    displayName: principal.displayName,
  };
}

function sessionError(error: unknown) {
  return error instanceof FabrikaSessionError
    ? NextResponse.json({ error: error.message }, { status: 401 })
    : null;
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = messageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Mesaj geçersiz.' },
        { status: 400 }
      );
    }
    const result = await processDigitalManagerMessage({
      manager: managerPrincipal(principal),
      message: parsed.data.message,
      clientRequestId: parsed.data.clientRequestId || randomUUID(),
      source: 'WEB',
    });
    if (!result.message) {
      return NextResponse.json(
        { error: 'Daha önceki isteğin yanıtı henüz hazırlanıyor.' },
        { status: 409 }
      );
    }
    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      message: result.message,
      requestMessageId: result.requestMessage.id,
      actions: result.actions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        status: action.status,
        requiresApproval: action.requiresApproval,
        policyDecision: action.policyDecision,
      })),
      context: result.context,
      provider: {
        ...sharedAssistantAIStatus(),
        activeProvider: result.provider,
        activeModel: result.model,
        sharedWithAssistant: true,
      },
    });
  } catch (error) {
    const response = sessionError(error);
    if (response) return response;
    console.error('[Digital Manager POST Error]:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Dijital Genel Müdür şu anda yanıt üretemedi.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const manager = managerPrincipal(principal);
    const [latestMessages, context] = await Promise.all([
      prisma.generalManagerMessage.findMany({
        where: { companyAccountId: principal.account.id },
        select: {
          id: true,
          role: true,
          content: true,
          authorName: true,
          authorType: true,
          provider: true,
          correlationId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      getGeneralManagerContext(manager),
    ]);
    return NextResponse.json({
      success: true,
      messages: latestMessages.reverse(),
      context: publicGeneralManagerContext(context),
      suggestions: generalManagerSuggestions(context),
      provider: {
        ...sharedAssistantAIStatus(),
        sharedWithAssistant: true,
      },
      managerName: 'Dijital Genel Müdür',
    });
  } catch (error) {
    const response = sessionError(error);
    if (response) return response;
    console.error('[Digital Manager GET Error]:', error);
    return NextResponse.json(
      { error: 'Dijital Genel Müdür verileri yüklenemedi.' },
      { status: 500 }
    );
  }
}

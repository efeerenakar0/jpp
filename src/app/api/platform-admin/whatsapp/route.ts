import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  dispatchWhatsAppOutboxMessage,
  refreshCompanyWhatsAppConnection,
} from '@/lib/company-whatsapp';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('refresh'),
    companyAccountId: z.string().min(1),
  }),
  z.object({
    action: z.literal('retry'),
    outboxId: z.string().min(1),
  }),
]);

export async function GET() {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  const [configs, queued, failed] = await Promise.all([
    prisma.whatsAppConfig.findMany({
      where: { companyAccountId: { not: null } },
      select: {
        companyAccountId: true,
        provider: true,
        connectionStatus: true,
        connectedPhone: true,
        connectedProfileName: true,
        lastConnectedAt: true,
        lastHealthCheckAt: true,
        lastError: true,
        companyAccount: {
          select: { companyName: true, slug: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.whatsAppOutboxMessage.groupBy({
      by: ['companyAccountId'],
      where: { status: 'QUEUED' },
      _count: { _all: true },
    }),
    prisma.whatsAppOutboxMessage.findMany({
      where: { status: 'FAILED' },
      select: {
        id: true,
        companyAccountId: true,
        toPhone: true,
        lastError: true,
        attemptCount: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ]);
  const queueMap = new Map(
    queued.map((item) => [item.companyAccountId, item._count._all])
  );
  return NextResponse.json({
    accounts: configs.map((config) => ({
      companyAccountId: config.companyAccountId,
      companyName: config.companyAccount?.companyName || 'Bilinmeyen şirket',
      slug: config.companyAccount?.slug || '',
      accountStatus: config.companyAccount?.status || 'UNKNOWN',
      provider: config.provider,
      connectionStatus: config.connectionStatus,
      connectedPhone: config.connectedPhone
        ? `••••${config.connectedPhone.slice(-4)}`
        : null,
      connectedProfileName: config.connectedProfileName,
      lastConnectedAt: config.lastConnectedAt,
      lastHealthCheckAt: config.lastHealthCheckAt,
      lastError: config.lastError,
      queued: config.companyAccountId
        ? queueMap.get(config.companyAccountId) || 0
        : 0,
    })),
    failed,
  });
}

export async function POST(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  }
  try {
    if (parsed.data.action === 'refresh') {
      return NextResponse.json(
        await refreshCompanyWhatsAppConnection(parsed.data.companyAccountId)
      );
    }
    const outbox = await prisma.whatsAppOutboxMessage.findUnique({
      where: { id: parsed.data.outboxId },
    });
    if (!outbox) {
      return NextResponse.json({ error: 'Kuyruk kaydı bulunamadı.' }, { status: 404 });
    }
    await prisma.whatsAppOutboxMessage.update({
      where: { id: outbox.id },
      data: {
        status: 'QUEUED',
        attemptCount: 0,
        failedAt: null,
        nextAttemptAt: new Date(),
      },
    });
    return NextResponse.json(await dispatchWhatsAppOutboxMessage(outbox.id));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'İşlem tamamlanamadı.',
      },
      { status: 502 }
    );
  }
}

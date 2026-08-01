import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  disconnectCompanyWhatsAppConnection,
  ensureCompanyWhatsAppConfig,
  prepareCompanyWhatsAppConnection,
  refreshCompanyWhatsAppConnection,
  serializeCompanyWhatsAppStatus,
} from '@/lib/company-whatsapp';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { parseWhatsAppConnectionAction } from '@/lib/whatsapp-connection-policy';

export const dynamic = 'force-dynamic';

function handleError(error: unknown) {
  if (
    error instanceof FabrikaSessionError ||
    error instanceof FabrikaForbiddenError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
    );
  }
  const message =
    error instanceof Error ? error.message : 'WhatsApp işlemi tamamlanamadı.';
  return NextResponse.json({ error: message }, { status: 502 });
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const config = await ensureCompanyWhatsAppConfig(principal.account.id);
    const queue = await prisma.whatsAppOutboxMessage.groupBy({
      by: ['status'],
      where: { companyAccountId: principal.account.id },
      _count: { _all: true },
    });
    return NextResponse.json({
      ...serializeCompanyWhatsAppStatus(config),
      queue: Object.fromEntries(
        queue.map((item) => [item.status, item._count._all])
      ),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = parseWhatsAppConnectionAction(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geçersiz WhatsApp bağlantı isteği.' },
        { status: 400 }
      );
    }
    if (parsed.data.action === 'prepare') {
      return NextResponse.json(
        await prepareCompanyWhatsAppConnection(principal.account.id)
      );
    }
    if (parsed.data.action === 'refresh') {
      return NextResponse.json(
        await refreshCompanyWhatsAppConnection(principal.account.id)
      );
    }
    if (parsed.data.action === 'disconnect') {
      const config = await disconnectCompanyWhatsAppConnection(
        principal.account.id
      );
      return NextResponse.json(serializeCompanyWhatsAppStatus(config));
    }
    const config = await ensureCompanyWhatsAppConfig(principal.account.id);
    const updated = await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: {
        autoReplyEnabled: parsed.data.autoReplyEnabled,
        allowFirstContact: parsed.data.allowFirstContact,
        dailyMessageLimit: parsed.data.dailyMessageLimit,
      },
    });
    return NextResponse.json(serializeCompanyWhatsAppStatus(updated));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Güvenlik nedeniyle bağlantı yalnızca açık kullanıcı onayıyla kapatılabilir.',
    },
    {
      status: 405,
      headers: { Allow: 'GET, POST' },
    }
  );
}

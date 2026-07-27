import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { NotificationType } from '@prisma/client';
import {
  createNotificationForPrincipal,
  ensureOperationalNotifications,
  notificationRecipientKey,
  type NotificationPrincipal,
} from '@/lib/fabrika-notifications';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

function unauthorized() {
  return NextResponse.json(
    { error: 'Bu işlem için Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

function toNotificationPrincipal(
  principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>
): NotificationPrincipal {
  return {
    accountId: principal.account.id,
    type: principal.type,
    memberId: principal.member?.id || null,
  };
}

export async function GET(request: Request) {
  try {
    const sessionPrincipal = await requireFabrikaPrincipal();
    const principal = toNotificationPrincipal(sessionPrincipal);
    const importantOnly =
      new URL(request.url).searchParams.get('scope') === 'important';
    await ensureOperationalNotifications(principal);
    const recipientKey = notificationRecipientKey(principal);
    const scopeWhere = {
      companyAccountId: principal.accountId,
      recipientKey,
    };
    const notifications = await prisma.notification.findMany({
      where: {
        ...scopeWhere,
        ...(importantOnly ? { important: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const [importantUnread, totalUnread] = await Promise.all([
      prisma.notification.count({
        where: { ...scopeWhere, important: true, read: false },
      }),
      prisma.notification.count({
        where: { ...scopeWhere, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      counts: { importantUnread, totalUnread },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('[Notification GET Error]:', error);
    return NextResponse.json(
      { error: 'Bildirimler veritabanından alınamadı.' },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionPrincipal = await requireFabrikaPrincipal();
    const principal = toNotificationPrincipal(sessionPrincipal);
    const recipientKey = notificationRecipientKey(principal);
    const body = (await request.json()) as {
      id?: string;
      read?: boolean;
      markAllRead?: boolean;
      scope?: 'important' | 'all';
    };
    const scopeWhere = {
      companyAccountId: principal.accountId,
      recipientKey,
    };

    if (body.markAllRead) {
      const result = await prisma.notification.updateMany({
        where: {
          ...scopeWhere,
          read: false,
          ...(body.scope === 'important' ? { important: true } : {}),
        },
        data: { read: true },
      });
      return NextResponse.json({ success: true, updated: result.count });
    }

    if (!body.id) {
      return NextResponse.json(
        { error: 'Bildirim ID’si gerekli.' },
        { status: 400 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: {
        ...scopeWhere,
        id: body.id,
      },
      data: { read: body.read ?? true },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Bildirim bulunamadı.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('[Notification PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Bildirim güncellenemedi.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionPrincipal = await requireFabrikaPrincipal();
    const principal = toNotificationPrincipal(sessionPrincipal);
    const body = (await request.json()) as {
      type?: NotificationType;
      title?: string;
      message?: string;
      link?: string;
      metadata?: unknown;
      important?: boolean;
      dedupeKey?: string;
    };

    if (!body.title?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { error: 'Bildirim başlığı ve mesajı gerekli.' },
        { status: 400 }
      );
    }

    if (
      body.type &&
      !Object.values(NotificationType).includes(body.type)
    ) {
      return NextResponse.json(
        { error: 'Geçersiz bildirim türü.' },
        { status: 400 }
      );
    }

    const notification = await createNotificationForPrincipal(principal, {
      type: body.type || NotificationType.SYSTEM,
      title: body.title.trim(),
      message: body.message.trim(),
      link: body.link,
      metadata: body.metadata,
      important: body.important,
      dedupeKey: body.dedupeKey,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('[Notification POST Error]:', error);
    return NextResponse.json(
      { error: 'Bildirim oluşturulamadı.' },
      { status: 503 }
    );
  }
}

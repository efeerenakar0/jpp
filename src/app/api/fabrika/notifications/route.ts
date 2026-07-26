import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { NotificationType } from '@prisma/client';
import { importantNotificationWhere } from '@/lib/important-notifications';

export async function GET(request: Request) {
  try {
    const importantOnly =
      new URL(request.url).searchParams.get('scope') === 'important';
    const notifications = await prisma.notification.findMany({
      ...(importantOnly ? { where: importantNotificationWhere } : {}),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('[Notification GET Error]:', error);
    return NextResponse.json(
      { error: 'Bildirimler veritabanından alınamadı.' },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      read?: boolean;
      markAllRead?: boolean;
    };

    if (body.markAllRead) {
      const result = await prisma.notification.updateMany({
        where: { read: false },
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

    const notification = await prisma.notification.update({
      where: { id: body.id },
      data: { read: body.read ?? true },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('[Notification PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Bildirim güncellenemedi.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: NotificationType;
      title?: string;
      message?: string;
      link?: string;
      metadata?: unknown;
    };

    if (!body.title?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { error: 'Bildirim başlığı ve mesajı gerekli.' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        type: body.type || 'SYSTEM',
        title: body.title.trim(),
        message: body.message.trim(),
        link: body.link,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('[Notification POST Error]:', error);
    return NextResponse.json(
      { error: 'Bildirim oluşturulamadı.' },
      { status: 503 }
    );
  }
}

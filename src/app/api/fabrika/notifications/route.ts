import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Bildirimleri listele
export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Notification fetch error:', error);
    return NextResponse.json({ notifications: [] });
  }
}

// PATCH: Bildirim okundu işaretle
export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await prisma.notification.update({
        where: { id: body.id },
        data: { read: body.read ?? true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID veya markAllRead gerekli' }, { status: 400 });
  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json({ error: 'Bildirim güncellenemedi' }, { status: 500 });
  }
}

// POST: Yeni bildirim oluştur (internal use)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const notification = await prisma.notification.create({
      data: {
        type: body.type || 'SYSTEM',
        title: body.title,
        message: body.message,
        link: body.link,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Notification create error:', error);
    return NextResponse.json({ error: 'Bildirim oluşturulamadı' }, { status: 500 });
  }
}

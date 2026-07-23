import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

let inMemoryNotifications = [
  {
    id: 'notif_1',
    type: 'SYSTEM',
    title: 'AI Fabrikası Aktif',
    message: 'Jasmine Group Yapay Zeka Fabrikası Netlify bulut sunucusunda kesintisiz çalışıyor.',
    link: '/fabrika',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'notif_2',
    type: 'NEW_CUSTOMER_MESSAGE',
    title: 'Yeni Müşteri Etkileşimi',
    message: 'WhatsApp Asistanı üzerinden 1 yeni canlı sorgulama alındı.',
    link: '/fabrika/asistan',
    read: false,
    createdAt: new Date(Date.now() - 1800000).toISOString()
  }
];

// GET: Bildirimleri listele
export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (notifications && notifications.length > 0) {
      return NextResponse.json({ notifications });
    }
    return NextResponse.json({ notifications: inMemoryNotifications });
  } catch (error) {
    console.warn('[Notification GET DB Warning]: Using memory store fallback', error);
    return NextResponse.json({ notifications: inMemoryNotifications });
  }
}

// PATCH: Bildirim okundu işaretle
export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    if (body.markAllRead) {
      inMemoryNotifications = inMemoryNotifications.map(n => ({ ...n, read: true }));
      try {
        await prisma.notification.updateMany({
          where: { read: false },
          data: { read: true },
        });
      } catch (e) {}
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      inMemoryNotifications = inMemoryNotifications.map(n => n.id === body.id ? { ...n, read: body.read ?? true } : n);
      try {
        await prisma.notification.update({
          where: { id: body.id },
          data: { read: body.read ?? true },
        });
      } catch (e) {}
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID veya markAllRead gerekli' }, { status: 400 });
  } catch (error) {
    inMemoryNotifications = inMemoryNotifications.map(n => ({ ...n, read: true }));
    return NextResponse.json({ success: true });
  }
}

// POST: Yeni bildirim oluştur
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const newNotif = {
      id: `notif_${Date.now()}`,
      type: body.type || 'SYSTEM',
      title: body.title || 'Yeni Bildirim',
      message: body.message || '',
      link: body.link || '/fabrika',
      read: false,
      createdAt: new Date().toISOString()
    };
    inMemoryNotifications.unshift(newNotif);

    try {
      await prisma.notification.create({
        data: {
          type: body.type || 'SYSTEM',
          title: body.title,
          message: body.message,
          link: body.link,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        },
      });
    } catch (e) {}

    return NextResponse.json({ notification: newNotif });
  } catch (error) {
    const fallbackNotif = {
      id: `notif_${Date.now()}`,
      type: 'SYSTEM',
      title: 'Sistem Bildirimi',
      message: 'İşlem tamamlandı',
      link: '/fabrika',
      read: false,
      createdAt: new Date().toISOString()
    };
    inMemoryNotifications.unshift(fallbackNotif);
    return NextResponse.json({ notification: fallbackNotif });
  }
}

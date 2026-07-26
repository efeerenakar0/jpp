import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function getIstanbulDayStart(referenceDate = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);

  return new Date(`${date}T00:00:00+03:00`);
}

export async function GET() {
  try {
    const today = getIstanbulDayStart();
    const [
      activeConversations,
      handoffConversations,
      todayMessages,
      incomingMessages,
      outgoingMessages,
      deliveredMessages,
      failedMessages,
      pendingAppointments,
      approvedToday,
    ] = await Promise.all([
      prisma.customerConversation.count({ where: { isActive: true } }),
      prisma.customerConversation.count({
        where: { isActive: true, aiEnabled: false },
      }),
      prisma.conversationMessage.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.conversationMessage.count({
        where: { role: 'customer', createdAt: { gte: today } },
      }),
      prisma.conversationMessage.count({
        where: {
          role: { in: ['assistant', 'patron'] },
          createdAt: { gte: today },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          deliveryStatus: { in: ['DELIVERED', 'READ'] },
          createdAt: { gte: today },
        },
      }),
      prisma.conversationMessage.count({
        where: { deliveryStatus: 'FAILED', createdAt: { gte: today } },
      }),
      prisma.appointmentRequest.count({ where: { status: 'PENDING' } }),
      prisma.appointmentRequest.count({
        where: { status: 'APPROVED', updatedAt: { gte: today } },
      }),
    ]);
    return NextResponse.json({
      activeConversations,
      handoffConversations,
      todayMessages,
      incomingMessages,
      outgoingMessages,
      deliveredMessages,
      failedMessages,
      pendingAppointments,
      approvedToday,
    });
  } catch (error) {
    console.error('[Assistant Metrics Error]:', error);
    return NextResponse.json(
      { error: 'Asistan istatistikleri alınamadı.' },
      { status: 503 }
    );
  }
}

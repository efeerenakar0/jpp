import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

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
    const principal = await requireFabrikaPrincipal();
    const accountId = principal.account.id;
    const conversationFilter = {
      conversation: { companyAccountId: accountId },
    };
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
      prisma.customerConversation.count({
        where: { companyAccountId: accountId, isActive: true },
      }),
      prisma.customerConversation.count({
        where: {
          companyAccountId: accountId,
          isActive: true,
          aiEnabled: false,
        },
      }),
      prisma.conversationMessage.count({
        where: { ...conversationFilter, createdAt: { gte: today } },
      }),
      prisma.conversationMessage.count({
        where: {
          ...conversationFilter,
          role: 'customer',
          createdAt: { gte: today },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          ...conversationFilter,
          role: { in: ['assistant', 'patron'] },
          createdAt: { gte: today },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          ...conversationFilter,
          deliveryStatus: { in: ['DELIVERED', 'READ'] },
          createdAt: { gte: today },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          ...conversationFilter,
          deliveryStatus: 'FAILED',
          createdAt: { gte: today },
        },
      }),
      prisma.appointmentRequest.count({
        where: {
          conversation: { companyAccountId: accountId },
          status: 'PENDING',
        },
      }),
      prisma.appointmentRequest.count({
        where: {
          conversation: { companyAccountId: accountId },
          status: 'APPROVED',
          updatedAt: { gte: today },
        },
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

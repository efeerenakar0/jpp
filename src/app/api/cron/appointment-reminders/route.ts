import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
} from '@/lib/assistant-messaging';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getAppointmentDateTime(date: Date, time: string) {
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return new Date(`${dateText}T${time}:00+03:00`);
}

function formatDate(date: Date) {
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
  });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz cron isteği.' }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 26 * 60 * 60 * 1000);
  const appointments = await prisma.appointmentRequest.findMany({
    where: {
      status: 'APPROVED',
      reminderSentAt: null,
      proposedDate: { not: null },
      proposedTime: { not: null },
    },
    include: { conversation: true },
  });
  const dueAppointments = appointments.filter((appointment) => {
    const appointmentAt = getAppointmentDateTime(
      appointment.proposedDate!,
      appointment.proposedTime!
    );
    return appointmentAt > now && appointmentAt <= horizon;
  });
  const results: Array<{
    appointmentId: string;
    status: 'sent' | 'failed';
    error?: string;
  }> = [];

  for (const appointment of dueAppointments) {
    try {
      if (!appointment.customerPhone) {
        throw new Error('Müşteri telefon numarası eksik.');
      }
      const content = `Merhaba ${appointment.customerName}, ${formatDate(
        appointment.proposedDate!
      )} saat ${appointment.proposedTime} için Jasmine Group randevunuzu hatırlatmak isteriz. Görüşmek üzere.`;
      const delivery = await sendAssistantWhatsAppMessage({
        to: appointment.customerPhone,
        text: content,
        lastCustomerMessageAt: appointment.conversation.lastCustomerMessageAt,
      });
      await saveOutgoingConversationMessage({
        conversationId: appointment.conversationId,
        content,
        delivery,
        role: 'patron',
      });
      await prisma.$transaction([
        prisma.appointmentRequest.update({
          where: { id: appointment.id },
          data: { reminderSentAt: new Date() },
        }),
        prisma.customerConversation.update({
          where: { id: appointment.conversationId },
          data: { summary: content },
        }),
      ]);
      results.push({ appointmentId: appointment.id, status: 'sent' });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Randevu Hatırlatması Gönderilemedi',
          message: `${appointment.customerName}: ${errorMessage}`,
          link: '/fabrika/asistan',
          metadata: JSON.stringify({ appointmentRequestId: appointment.id }),
        },
      });
      results.push({
        appointmentId: appointment.id,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  return NextResponse.json({
    checked: appointments.length,
    due: dueAppointments.length,
    sent: results.filter((result) => result.status === 'sent').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  });
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
} from '@/lib/assistant-messaging';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { processAppointmentLifecycle } from '@/lib/viewing-workflow/lifecycle';
import { resolveViewingWorkflowTimings } from '@/lib/viewing-workflow/timing-policy';

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
  const appointments = await prisma.appointmentRequest.findMany({
    where: {
      status: 'APPROVED',
      customerReminderSentAt: null,
      OR: [
        { startAt: { not: null } },
        {
          proposedDate: { not: null },
          proposedTime: { not: null },
        },
      ],
    },
    include: {
      conversation: true,
      companyAccount: {
        select: { companyName: true, onboardingState: true },
      },
    },
  });
  const dueAppointments = appointments.filter((appointment) => {
    const appointmentAt =
      appointment.startAt ||
      getAppointmentDateTime(
        appointment.proposedDate!,
        appointment.proposedTime!
      );
    const timings = resolveViewingWorkflowTimings(
      appointment.companyAccount.onboardingState,
      appointment.companyAccount.companyName
    );
    const reminderAt = new Date(
      appointmentAt.getTime() -
        timings.appointmentReminderHours * 60 * 60 * 1_000
    );
    return appointmentAt > now && reminderAt <= now;
  });
  const results: Array<{
    appointmentId: string;
    status: 'sent' | 'pending' | 'failed';
    error?: string;
  }> = [];

  for (const appointment of dueAppointments) {
    try {
      if (!appointment.conversation.companyAccountId) {
        throw new Error('Randevu şirket hesabına bağlanmamış.');
      }
      if (!appointment.customerPhone) {
        throw new Error('Müşteri telefon numarası eksik.');
      }
      const appointmentAt =
        appointment.startAt ||
        getAppointmentDateTime(
          appointment.proposedDate!,
          appointment.proposedTime!
        );
      const appointmentTime = appointmentAt.toLocaleTimeString('tr-TR', {
        timeZone: appointment.timezone || 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
      });
      const content = `Merhaba ${appointment.customerName}, ${formatDate(
        appointmentAt
      )} saat ${appointmentTime} için randevunuzu hatırlatmak isteriz. Görüşmek üzere.`;
      const delivery = await sendAssistantWhatsAppMessage({
        companyAccountId: appointment.conversation.companyAccountId,
        to: appointment.customerPhone,
        text: content,
        lastCustomerMessageAt: appointment.conversation.lastCustomerMessageAt,
        conversationId: appointment.conversationId,
        correlationId: appointment.id,
        idempotencyKey: `appointment:${appointment.id}:customer-reminder`,
        createdByType: 'SYSTEM',
        createdById: appointment.id,
      });
      await saveOutgoingConversationMessage({
        conversationId: appointment.conversationId,
        content,
        delivery,
        role: 'patron',
      });
      if (delivery.deliveryStatus === 'QUEUED') {
        results.push({ appointmentId: appointment.id, status: 'pending' });
        continue;
      }
      if (
        !['SENT', 'DELIVERED', 'READ'].includes(delivery.deliveryStatus)
      ) {
        throw new Error(
          `WhatsApp hatırlatması teslim edilemedi (${delivery.deliveryStatus}).`
        );
      }
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.appointmentRequest.updateMany({
          where: {
            id: appointment.id,
            customerReminderSentAt: null,
          },
          data: {
            reminderSentAt: now,
            customerReminderSentAt: now,
          },
        });
        if (claimed.count === 1) {
          await tx.customerConversation.update({
            where: { id: appointment.conversationId },
            data: { summary: content },
          });
        }
      });
      results.push({ appointmentId: appointment.id, status: 'sent' });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      if (appointment.conversation.companyAccountId) {
        await createCompanyNotification({
          companyAccountId: appointment.conversation.companyAccountId,
          type: 'SYSTEM',
          title: 'Randevu Hatırlatması Gönderilemedi',
          message: `${appointment.customerName}: ${errorMessage}`,
          link: '/fabrika/asistan',
          important: true,
          dedupeKey: `appointment-reminder-failed:${appointment.id}`,
          metadata: { appointmentRequestId: appointment.id },
        });
      }
      results.push({
        appointmentId: appointment.id,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  const lifecycle = await processAppointmentLifecycle(now);

  return NextResponse.json({
    checked: appointments.length,
    due: dueAppointments.length,
    sent: results.filter((result) => result.status === 'sent').length,
    pending: results.filter((result) => result.status === 'pending').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
    appointmentLifecycleActions: lifecycle,
  });
}

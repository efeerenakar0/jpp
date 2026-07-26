import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
  WhatsAppTemplateRequiredError,
} from '@/lib/assistant-messaging';

type AppointmentAction =
  | 'approve'
  | 'reject'
  | 'resend'
  | 'reschedule'
  | 'cancel'
  | 'remind';

function formatAppointmentDate(date: Date | null) {
  return date
    ? date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
    : 'belirlenen tarih';
}

function buildAppointmentMessage(
  action: Exclude<AppointmentAction, 'reject'>,
  appointment: {
    customerName: string;
    proposedDate: Date | null;
    proposedTime: string | null;
  }
) {
  const date = formatAppointmentDate(appointment.proposedDate);
  const time = appointment.proposedTime || 'belirlenen saat';

  switch (action) {
    case 'cancel':
      return `Merhaba ${appointment.customerName}, ${date} saat ${time} için planlanan Jasmine Group randevunuz iptal edildi. Yeni bir zaman belirlemek isterseniz bize yazabilirsiniz.`;
    case 'reschedule':
      return `Merhaba ${appointment.customerName}, Jasmine Group randevunuz ${date} saat ${time} olarak güncellendi. Görüşmek üzere.`;
    case 'remind':
      return `Merhaba ${appointment.customerName}, ${date} saat ${time} için Jasmine Group randevunuzu hatırlatmak isteriz. Görüşmek üzere.`;
    case 'approve':
    case 'resend':
      return `Merhaba ${appointment.customerName}, ${date} saat ${time} için randevu talebiniz Jasmine Group tarafından onaylandı. Görüşmek üzere.`;
  }
}

function isAppointmentAction(value: unknown): value is AppointmentAction {
  return (
    typeof value === 'string' &&
    ['approve', 'reject', 'resend', 'reschedule', 'cancel', 'remind'].includes(
      value
    )
  );
}

function parseProposedDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(`${value.trim()}T09:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET() {
  try {
    const appointments = await prisma.appointmentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          select: {
            summary: true,
            lastCustomerMessageAt: true,
          },
        },
      },
    });
    const sentMessages = await prisma.conversationMessage.findMany({
      where: {
        role: { in: ['assistant', 'patron'] },
        providerMessageId: { not: null },
        deliveryStatus: { not: 'FAILED' },
      },
      select: {
        conversationId: true,
        content: true,
      },
    });
    const sentKeys = new Set(
      sentMessages.map((message) =>
        JSON.stringify([message.conversationId, message.content])
      )
    );

    return NextResponse.json(
      appointments.map((appointment) => ({
        ...appointment,
        confirmationSent: Boolean(
          appointment.confirmMessage &&
            sentKeys.has(
              JSON.stringify([
                appointment.conversationId,
                appointment.confirmMessage,
              ])
            )
        ),
      }))
    );
  } catch (error) {
    console.error('[Appointments GET Error]:', error);
    return NextResponse.json(
      { error: 'Randevular alınamadı.' },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      action?: AppointmentAction;
      patronNote?: string;
      proposedDate?: string;
      proposedTime?: string;
    };
    const id = body.id?.trim();
    const action = body.action;

    if (!id || !isAppointmentAction(action)) {
      return NextResponse.json(
        { error: 'Geçersiz randevu işlemi.' },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointmentRequest.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: 'Randevu bulunamadı.' },
        { status: 404 }
      );
    }

    if (action === 'reject') {
      if (appointment.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Yalnızca bekleyen randevular reddedilebilir.' },
          { status: 409 }
        );
      }

      const updated = await prisma.appointmentRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          patronNote: body.patronNote?.trim() || null,
        },
      });
      return NextResponse.json(updated);
    }

    if (action === 'approve' && appointment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Bu randevu daha önce işlendi.' },
        { status: 409 }
      );
    }
    if (
      action === 'approve' &&
      (!appointment.proposedDate || !appointment.proposedTime)
    ) {
      return NextResponse.json(
        {
          error:
            'Onaylamadan önce randevu tarihini ve saatini belirleyin.',
        },
        { status: 400 }
      );
    }
    if (
      ['resend', 'cancel', 'remind'].includes(action) &&
      appointment.status !== 'APPROVED'
    ) {
      return NextResponse.json(
        { error: 'Bu işlem yalnızca onaylanmış randevularda kullanılabilir.' },
        { status: 409 }
      );
    }
    if (
      action === 'reschedule' &&
      ['REJECTED', 'CANCELLED'].includes(appointment.status)
    ) {
      return NextResponse.json(
        { error: 'Reddedilmiş veya iptal edilmiş randevu değiştirilemez.' },
        { status: 409 }
      );
    }
    const proposedDate =
      action === 'reschedule'
        ? parseProposedDate(body.proposedDate)
        : appointment.proposedDate;
    const proposedTime =
      action === 'reschedule'
        ? body.proposedTime?.trim() || null
        : appointment.proposedTime;

    if (action === 'reschedule' && (!proposedDate || !proposedTime)) {
      return NextResponse.json(
        { error: 'Yeni randevu tarihi ve saati gerekli.' },
        { status: 400 }
      );
    }

    if (action === 'reschedule' && appointment.status === 'PENDING') {
      const updated = await prisma.appointmentRequest.update({
        where: { id },
        data: {
          proposedDate,
          proposedTime,
          rescheduledAt: new Date(),
        },
      });
      return NextResponse.json({
        ...updated,
        confirmationSent: false,
      });
    }

    if (!appointment.customerPhone) {
      return NextResponse.json(
        { error: 'Müşterinin WhatsApp telefon numarası bulunamadı.' },
        { status: 400 }
      );
    }

    const messageAppointment = {
      customerName: appointment.customerName,
      proposedDate,
      proposedTime,
    };
    const content = buildAppointmentMessage(action, messageAppointment);
    const delivery = await sendAssistantWhatsAppMessage({
      to: appointment.customerPhone,
      text: content,
      lastCustomerMessageAt: appointment.conversation.lastCustomerMessageAt,
    });
    const messageRecord = await saveOutgoingConversationMessage({
      conversationId: appointment.conversationId,
      content,
      delivery,
      role: 'patron',
    });
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          type: 'SYSTEM',
          title:
            action === 'cancel'
              ? 'Randevu İptal Edildi'
              : action === 'reschedule'
                ? 'Randevu Değiştirildi'
                : action === 'remind'
                  ? 'Randevu Hatırlatıldı'
                  : 'Randevu Onayı Gönderildi',
          message: `${appointment.customerName} için WhatsApp mesajı gönderildi.`,
          link: '/fabrika/asistan',
          metadata: JSON.stringify({
            appointmentRequestId: appointment.id,
            providerMessageId: delivery.providerMessageId,
            action,
          }),
        },
      });
      await tx.customerConversation.update({
        where: { id: appointment.conversationId },
        data: { summary: content },
      });

      return tx.appointmentRequest.update({
        where: { id },
        data: {
          status: action === 'cancel' ? 'CANCELLED' : 'APPROVED',
          patronNote: body.patronNote?.trim() || appointment.patronNote,
          proposedDate,
          proposedTime,
          confirmMessage: content,
          reminderSentAt: action === 'remind' ? now : action === 'reschedule' ? null : appointment.reminderSentAt,
          rescheduledAt: action === 'reschedule' ? now : appointment.rescheduledAt,
          cancelledAt: action === 'cancel' ? now : appointment.cancelledAt,
        },
      });
    });

    return NextResponse.json({
      ...updated,
      confirmationSent: true,
      providerMessageId: delivery.providerMessageId,
      messageRecord,
    });
  } catch (error) {
    console.error('[Appointment PATCH Error]:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Randevu güncellenirken bilinmeyen bir hata oluştu.',
      },
      { status: error instanceof WhatsAppTemplateRequiredError ? 409 : 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';

function buildConfirmationMessage(appointment: {
  customerName: string;
  proposedDate: Date | null;
  proposedTime: string | null;
}) {
  const date = appointment.proposedDate
    ? appointment.proposedDate.toLocaleDateString('tr-TR', {
        timeZone: 'Europe/Istanbul'
      })
    : 'belirlenen tarih';
  const time = appointment.proposedTime || 'belirlenen saat';

  return `Merhaba ${appointment.customerName}, ${date} saat ${time} için randevu talebiniz Jasmine Group tarafından onaylandı. Görüşmek üzere.`;
}

function deliveryKey(conversationId: string, content: string) {
  return JSON.stringify([conversationId, content]);
}

export async function GET() {
  try {
    const [appointments, deliveredMessages] = await Promise.all([
      prisma.appointmentRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            select: { summary: true }
          }
        }
      }),
      prisma.conversationMessage.findMany({
        where: {
          role: 'assistant',
          metadata: {
            contains: '"channel":"whatsapp"'
          }
        },
        select: {
          conversationId: true,
          content: true
        }
      })
    ]);

    const deliveredKeys = new Set(
      deliveredMessages.map((message) =>
        deliveryKey(message.conversationId, message.content)
      )
    );

    return NextResponse.json(
      appointments.map((appointment) => ({
        ...appointment,
        confirmationSent: Boolean(
          appointment.confirmMessage &&
            deliveredKeys.has(
              deliveryKey(appointment.conversationId, appointment.confirmMessage)
            )
        )
      }))
    );
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json([]);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, patronNote } = body;

    if (!id || !['approve', 'reject', 'resend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const appointment = await prisma.appointmentRequest.findUnique({
      where: { id },
      include: { conversation: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (action === 'reject') {
      const updated = await prisma.appointmentRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          patronNote
        }
      });

      return NextResponse.json(updated);
    }

    if (action === 'approve' && appointment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Bu randevu daha önce işlendi. Gerekirse yeniden gönder seçeneğini kullanın.' },
        { status: 409 }
      );
    }

    if (action === 'resend' && appointment.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Yalnızca onaylanmış randevuların mesajı yeniden gönderilebilir.' },
        { status: 409 }
      );
    }

    if (!appointment.customerPhone) {
      return NextResponse.json(
        { error: 'Müşterinin WhatsApp telefon numarası bulunamadı.' },
        { status: 400 }
      );
    }

    const confirmMessage = buildConfirmationMessage(appointment);

    const metaResponse = await sendMetaWhatsAppMessage({
      to: appointment.customerPhone,
      text: confirmMessage
    });
    const metaMessageId = metaResponse.messages?.[0]?.id;

    if (!metaMessageId) {
      throw new Error('Meta WhatsApp mesaj kimliği döndürmedi.');
    }

    const previousMessage =
      action === 'resend'
        ? await prisma.conversationMessage.findFirst({
            where: {
              conversationId: appointment.conversationId,
              role: 'assistant',
              content: confirmMessage
            },
            orderBy: { createdAt: 'desc' }
          })
        : null;

    const deliveryMetadata = JSON.stringify({
      channel: 'whatsapp',
      status: 'SENT',
      metaMessageId,
      sentAt: new Date().toISOString()
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (previousMessage) {
        await tx.conversationMessage.update({
          where: { id: previousMessage.id },
          data: { metadata: deliveryMetadata }
        });
      } else {
        await tx.conversationMessage.create({
          data: {
            conversationId: appointment.conversationId,
            role: 'assistant',
            content: confirmMessage,
            metadata: deliveryMetadata
          }
        });
      }

      await tx.notification.create({
        data: {
          type: 'SYSTEM',
          title:
            action === 'resend'
              ? 'Randevu Onayı WhatsApp’a Gönderildi'
              : 'Randevu Onaylandı',
          message: `${appointment.customerName} için randevu onayı WhatsApp üzerinden gönderildi.`
        }
      });

      return tx.appointmentRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          patronNote,
          confirmMessage
        }
      });
    });

    return NextResponse.json({
      ...updated,
      confirmationSent: true,
      metaMessageId
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Randevu güncellenirken bilinmeyen bir hata oluştu.'
      },
      { status: 500 }
    );
  }
}

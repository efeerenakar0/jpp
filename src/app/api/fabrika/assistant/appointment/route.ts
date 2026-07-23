import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';

export async function GET() {
  try {
    const appointments = await prisma.appointmentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          select: { summary: true }
        }
      }
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json([]);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, patronNote } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const appointment = await prisma.appointmentRequest.findUnique({
      where: { id },
      include: { conversation: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    let confirmMessage = null;
    let status = action === 'approve' ? 'APPROVED' : 'REJECTED';

    if (action === 'approve') {
      // Generate confirmation message
      const prompt = PROMPTS.appointmentConfirm({
        customerName: appointment.customerName,
        date: appointment.proposedDate ? new Date(appointment.proposedDate).toLocaleDateString('tr-TR') : 'Belirtilmedi',
        time: appointment.proposedTime || 'Belirtilmedi',
        companyName: 'Jasmine Group'
      });

      const aiResponse = await callAI([{ role: 'system', content: prompt }], 'appointment_confirm');
      confirmMessage = aiResponse.content;

      // Create notification
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Randevu Onaylandı',
          message: `${appointment.customerName} için randevu onaylandı ve mesaj üretildi.`,
        }
      });
      
      // Optionally add message to conversation
      await prisma.conversationMessage.create({
        data: {
          conversationId: appointment.conversationId,
          role: 'assistant',
          content: confirmMessage
        }
      });
    }

    const updated = await prisma.appointmentRequest.update({
      where: { id },
      data: {
        status: status as any,
        patronNote,
        confirmMessage
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
}

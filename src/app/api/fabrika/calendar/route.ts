import {
  CrmTaskStatus,
  CrmTaskType,
  NotificationType,
} from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import {
  deleteTaskFromGoogle,
  googleCalendarConfigured,
  syncCompanyGoogleCalendar,
  syncSingleTaskToGoogle,
} from '@/lib/google-calendar';
import prisma from '@/lib/prisma';

const optionalId = z.string().trim().min(1).optional().nullable();
const eventFields = {
  title: z.string().trim().min(2).max(180),
  type: z.nativeEnum(CrmTaskType).default(CrmTaskType.FOLLOW_UP),
  description: z.string().trim().max(5000).optional().nullable(),
  dueAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().default(false),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  contactId: optionalId,
  propertyId: optionalId,
  dealId: optionalId,
  assignedMemberId: optionalId,
};

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create-event'), ...eventFields }),
  z.object({
    action: z.literal('update-event'),
    id: z.string().trim().min(1),
    ...eventFields,
  }),
  z.object({
    action: z.literal('toggle-event'),
    id: z.string().trim().min(1),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal('delete-event'),
    id: z.string().trim().min(1),
  }),
  z.object({ action: z.literal('sync-google') }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

async function ensureOwnedId(
  model: 'contact' | 'property' | 'deal' | 'member',
  id: string | null | undefined,
  companyAccountId: string
) {
  if (!id) return null;
  const resource =
    model === 'contact'
      ? await prisma.crmContact.findFirst({
          where: { id, companyAccountId },
          select: { id: true },
        })
      : model === 'property'
        ? await prisma.crmProperty.findFirst({
            where: { id, companyAccountId },
            select: { id: true },
          })
        : model === 'deal'
          ? await prisma.crmDeal.findFirst({
              where: { id, companyAccountId },
              select: { id: true },
            })
          : await prisma.companyMember.findFirst({
              where: { id, companyAccountId, active: true },
              select: { id: true },
            });
  if (!resource) throw new Error('Seçilen kayıt bu şirkete ait değil.');
  return resource.id;
}

async function calendarData(
  companyAccountId: string,
  permissions: Awaited<
    ReturnType<typeof requireFabrikaPrincipal>
  >['permissions']
) {
  const rangeStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const [tasks, contacts, properties, deals, members, connection, logs] =
    await Promise.all([
      prisma.crmTask.findMany({
        where: {
          companyAccountId,
          dueAt: { gte: rangeStart, lte: rangeEnd },
        },
        include: {
          contact: { select: { id: true, name: true, phone: true } },
          property: { select: { id: true, title: true, location: true } },
          deal: { select: { id: true, title: true } },
          assignedMember: { select: { id: true, name: true } },
        },
        orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
        take: 1000,
      }),
      prisma.crmContact.findMany({
        where: { companyAccountId },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
      }),
      prisma.crmProperty.findMany({
        where: { companyAccountId, status: { in: ['ACTIVE', 'RESERVED'] } },
        select: { id: true, title: true, location: true },
        orderBy: { title: 'asc' },
      }),
      prisma.crmDeal.findMany({
        where: {
          companyAccountId,
          stage: { notIn: ['WON', 'LOST'] },
        },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.companyMember.findMany({
        where: { companyAccountId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.googleCalendarConnection.findUnique({
        where: { companyAccountId },
        select: {
          email: true,
          calendarId: true,
          lastSyncedAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
          updatedAt: true,
        },
      }),
      prisma.calendarSyncLog.findMany({
        where: { companyAccountId },
        select: {
          id: true,
          status: true,
          pulledCount: true,
          pushedCount: true,
          conflictCount: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 8,
      }),
    ]);

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
  return {
    tasks,
    contacts,
    properties,
    deals,
    members,
    permissions,
    google: {
      configured: googleCalendarConfigured(),
      connected: Boolean(connection),
      ...connection,
    },
    syncLogs: logs,
    metrics: {
      today: tasks.filter(
        (task) =>
          task.dueAt &&
          task.dueAt >= todayStart &&
          task.dueAt < todayEnd &&
          task.status === 'OPEN'
      ).length,
      nextSevenDays: tasks.filter(
        (task) =>
          task.dueAt &&
          task.dueAt.getTime() >= now &&
          task.dueAt.getTime() <= nextWeek &&
          task.status === 'OPEN'
      ).length,
      appointments: tasks.filter(
        (task) =>
          ['MEETING', 'VIEWING'].includes(task.type) &&
          task.status === 'OPEN' &&
          task.dueAt &&
          task.dueAt.getTime() >= now
      ).length,
      overdue: tasks.filter(
        (task) =>
          task.status === 'OPEN' &&
          task.dueAt &&
          task.dueAt.getTime() < now
      ).length,
    },
  };
}

async function eventRelations(
  input: {
    contactId?: string | null;
    propertyId?: string | null;
    dealId?: string | null;
    assignedMemberId?: string | null;
  },
  companyAccountId: string
) {
  const [contactId, propertyId, dealId, assignedMemberId] = await Promise.all([
    ensureOwnedId('contact', input.contactId, companyAccountId),
    ensureOwnedId('property', input.propertyId, companyAccountId),
    ensureOwnedId('deal', input.dealId, companyAccountId),
    ensureOwnedId('member', input.assignedMemberId, companyAccountId),
  ]);
  return { contactId, propertyId, dealId, assignedMemberId };
}

function eventDates(input: { dueAt: string; endAt?: string | null }) {
  const dueAt = new Date(input.dueAt);
  const endAt = input.endAt ? new Date(input.endAt) : null;
  if (endAt && endAt.getTime() <= dueAt.getTime()) {
    throw new Error('Bitiş zamanı başlangıçtan sonra olmalıdır.');
  }
  return { dueAt, endAt };
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    return NextResponse.json({
      success: true,
      calendar: await calendarData(
        principal.account.id,
        principal.permissions
      ),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('Calendar GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Takvim verileri yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Geçersiz takvim işlemi.',
        },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const companyAccountId = principal.account.id;
    let message = 'Takvim güncellendi.';
    let syncWarning: string | null = null;

    if (input.action === 'create-event') {
      const relations = await eventRelations(input, companyAccountId);
      const dates = eventDates(input);
      const task = await prisma.crmTask.create({
        data: {
          companyAccountId,
          ...relations,
          ...dates,
          title: input.title,
          type: input.type,
          description: input.description?.trim() || null,
          allDay: input.allDay,
          priority: input.priority,
          calendarSyncStatus: 'LOCAL',
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId,
          contactId: relations.contactId,
          propertyId: relations.propertyId,
          dealId: relations.dealId,
          actorMemberId: principal.member?.id || null,
          type: 'CALENDAR_EVENT_CREATED',
          title: 'Takvim kaydı oluşturuldu',
          description: input.title,
          metadata: JSON.stringify({ taskId: task.id, dueAt: task.dueAt }),
        },
      });
      const connection = await prisma.googleCalendarConnection.findUnique({
        where: { companyAccountId },
        select: { id: true },
      });
      if (connection) {
        try {
          await syncSingleTaskToGoogle(companyAccountId, task.id);
        } catch (error) {
          syncWarning =
            error instanceof Error
              ? error.message
              : 'Google senkronu beklemeye alındı.';
        }
      }
      if (
        ['MEETING', 'VIEWING'].includes(input.type) &&
        dates.dueAt.getTime() >= Date.now() &&
        dates.dueAt.getTime() <= Date.now() + 24 * 60 * 60 * 1000
      ) {
        await createCompanyNotification({
          companyAccountId,
          type: NotificationType.APPOINTMENT_REQUEST,
          title:
            input.type === CrmTaskType.VIEWING
              ? 'Yaklaşan Portföy Gösterimi'
              : 'Yaklaşan Randevu',
          message: `${input.title} önümüzdeki 24 saat içinde gerçekleşecek.`,
          link: '/fabrika/takvim',
          important: true,
          dedupeKey: `upcoming-appointment:${task.id}`,
          metadata: { taskId: task.id, dueAt: task.dueAt },
        });
      }
      message = 'Takvim kaydı oluşturuldu.';
    }

    if (input.action === 'update-event') {
      const existing = await prisma.crmTask.findFirst({
        where: { id: input.id, companyAccountId },
      });
      if (!existing) throw new Error('Takvim kaydı bulunamadı.');
      const relations = await eventRelations(input, companyAccountId);
      const dates = eventDates(input);
      const task = await prisma.crmTask.update({
        where: { id: existing.id },
        data: {
          ...relations,
          ...dates,
          title: input.title,
          type: input.type,
          description: input.description?.trim() || null,
          allDay: input.allDay,
          priority: input.priority,
          calendarSyncStatus: existing.googleEventId ? 'PENDING' : 'LOCAL',
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId,
          contactId: relations.contactId,
          propertyId: relations.propertyId,
          dealId: relations.dealId,
          actorMemberId: principal.member?.id || null,
          type: 'CALENDAR_EVENT_UPDATED',
          title: 'Takvim kaydı güncellendi',
          description: input.title,
          metadata: JSON.stringify({ taskId: task.id, dueAt: task.dueAt }),
        },
      });
      if (existing.googleEventId) {
        try {
          await syncSingleTaskToGoogle(companyAccountId, task.id);
        } catch (error) {
          syncWarning =
            error instanceof Error
              ? error.message
              : 'Google senkronu beklemeye alındı.';
        }
      }
      message = 'Takvim kaydı güncellendi.';
    }

    if (input.action === 'toggle-event') {
      const task = await prisma.crmTask.findFirst({
        where: { id: input.id, companyAccountId },
      });
      if (!task) throw new Error('Takvim kaydı bulunamadı.');
      await prisma.crmTask.update({
        where: { id: task.id },
        data: {
          status: input.completed
            ? CrmTaskStatus.COMPLETED
            : CrmTaskStatus.OPEN,
          completedAt: input.completed ? new Date() : null,
        },
      });
      message = input.completed ? 'Kayıt tamamlandı.' : 'Kayıt yeniden açıldı.';
    }

    if (input.action === 'delete-event') {
      const task = await prisma.crmTask.findFirst({
        where: { id: input.id, companyAccountId },
      });
      if (!task) throw new Error('Takvim kaydı bulunamadı.');
      await deleteTaskFromGoogle(companyAccountId, task);
      await prisma.crmTask.delete({ where: { id: task.id } });
      message = 'Takvim kaydı silindi.';
    }

    if (input.action === 'sync-google') {
      const result = await syncCompanyGoogleCalendar(companyAccountId);
      message = `${result.pulledCount} Google kaydı alındı, ${result.pushedCount} Business CEO AI kaydı gönderildi.`;
    }

    return NextResponse.json({
      success: true,
      message,
      syncWarning,
      calendar: await calendarData(
        companyAccountId,
        principal.permissions
      ),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('Calendar POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Takvim işlemi tamamlanamadı.',
      },
      { status: 500 }
    );
  }
}

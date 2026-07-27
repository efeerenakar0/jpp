import { CrmTaskStatus, CrmTaskType } from '@prisma/client';
import {
  decryptCalendarToken,
  encryptCalendarToken,
} from './calendar-crypto';
import prisma from './prisma';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_API_ROOT = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];
const TIME_ZONE = 'Europe/Istanbul';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

type GoogleEventList = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  error?: { code?: number; message?: string };
};

function googleClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Calendar OAuth bilgileri henüz sunucuda yapılandırılmamış.'
    );
  }
  return { clientId, clientSecret };
}

export function googleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()
  );
}

export function googleCalendarRedirectUri(origin: string) {
  return `${origin}/api/fabrika/calendar/google/callback`;
}

export function buildGoogleCalendarAuthorizationUrl(input: {
  origin: string;
  state: string;
}) {
  const { clientId } = googleClient();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleCalendarRedirectUri(input.origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('state', input.state);
  return url.toString();
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    cache: 'no-store',
  });
  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        'Google erişim belirteci alınamadı.'
    );
  }
  return data;
}

export async function exchangeGoogleCalendarCode(input: {
  code: string;
  origin: string;
}) {
  const { clientId, clientSecret } = googleClient();
  return tokenRequest(
    new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleCalendarRedirectUri(input.origin),
      grant_type: 'authorization_code',
    })
  );
}

export async function getGoogleAccountEmail(accessToken: string) {
  const response = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email?.trim() || null;
}

export async function saveGoogleCalendarConnection(input: {
  companyAccountId: string;
  connectedByMemberId?: string | null;
  email?: string | null;
  token: GoogleTokenResponse;
}) {
  if (!input.token.access_token) {
    throw new Error('Google erişim belirteci eksik.');
  }
  const existing = await prisma.googleCalendarConnection.findUnique({
    where: { companyAccountId: input.companyAccountId },
  });
  const refreshToken =
    input.token.refresh_token ||
    (existing
      ? decryptCalendarToken(existing.encryptedRefreshToken)
      : null);
  if (!refreshToken) {
    throw new Error(
      'Google yenileme belirteci alınamadı. Bağlantıyı kaldırıp yeniden izin verin.'
    );
  }
  const expiresAt = input.token.expires_in
    ? new Date(Date.now() + input.token.expires_in * 1000)
    : null;
  return prisma.googleCalendarConnection.upsert({
    where: { companyAccountId: input.companyAccountId },
    create: {
      companyAccountId: input.companyAccountId,
      connectedByMemberId: input.connectedByMemberId || null,
      email: input.email || null,
      encryptedAccessToken: encryptCalendarToken(input.token.access_token),
      encryptedRefreshToken: encryptCalendarToken(refreshToken),
      accessTokenExpiresAt: expiresAt,
      scope: input.token.scope || GOOGLE_SCOPES.join(' '),
      lastSyncStatus: 'CONNECTED',
      lastSyncError: null,
    },
    update: {
      connectedByMemberId: input.connectedByMemberId || null,
      email: input.email || null,
      encryptedAccessToken: encryptCalendarToken(input.token.access_token),
      encryptedRefreshToken: encryptCalendarToken(refreshToken),
      accessTokenExpiresAt: expiresAt,
      scope: input.token.scope || existing?.scope || GOOGLE_SCOPES.join(' '),
      syncToken: null,
      lastSyncStatus: 'CONNECTED',
      lastSyncError: null,
    },
  });
}

async function accessToken(companyAccountId: string, forceRefresh = false) {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { companyAccountId },
  });
  if (!connection) throw new Error('Google Calendar bağlantısı bulunmuyor.');
  if (
    !forceRefresh &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return {
      connection,
      token: decryptCalendarToken(connection.encryptedAccessToken),
    };
  }

  const { clientId, clientSecret } = googleClient();
  const refreshed = await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptCalendarToken(connection.encryptedRefreshToken),
      grant_type: 'refresh_token',
    })
  );
  const updated = await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptCalendarToken(refreshed.access_token!),
      accessTokenExpiresAt: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null,
      scope: refreshed.scope || connection.scope,
    },
  });
  return { connection: updated, token: refreshed.access_token! };
}

async function googleFetch(
  companyAccountId: string,
  path: string,
  init?: RequestInit,
  retry = true
) {
  const auth = await accessToken(companyAccountId);
  const response = await fetch(`${GOOGLE_API_ROOT}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (response.status === 401 && retry) {
    await accessToken(companyAccountId, true);
    return googleFetch(companyAccountId, path, init, false);
  }
  return response;
}

function dateInIstanbul(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nextDay(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function taskEventBody(task: {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
  type: CrmTaskType;
  priority: number;
}) {
  if (!task.dueAt) throw new Error('Takvim kaydının başlangıç tarihi yok.');
  const startDate = dateInIstanbul(task.dueAt);
  const endDate = task.endAt ? dateInIstanbul(task.endAt) : nextDay(startDate);
  return {
    summary: task.title,
    description: task.description || undefined,
    start: task.allDay
      ? { date: startDate }
      : { dateTime: task.dueAt.toISOString(), timeZone: TIME_ZONE },
    end: task.allDay
      ? { date: endDate === startDate ? nextDay(startDate) : endDate }
      : {
          dateTime: (
            task.endAt ||
            new Date(task.dueAt.getTime() + 60 * 60 * 1000)
          ).toISOString(),
          timeZone: TIME_ZONE,
        },
    extendedProperties: {
      private: {
        jasmineTaskId: task.id,
        jasmineTaskType: task.type,
        jasminePriority: String(task.priority),
      },
    },
  };
}

export async function syncSingleTaskToGoogle(
  companyAccountId: string,
  taskId: string
) {
  const [connection, task] = await Promise.all([
    prisma.googleCalendarConnection.findUnique({
      where: { companyAccountId },
    }),
    prisma.crmTask.findFirst({
      where: { id: taskId, companyAccountId },
    }),
  ]);
  if (!connection || !task?.dueAt || task.status === CrmTaskStatus.CANCELLED) {
    return null;
  }
  const body = taskEventBody(task);
  const calendarId = encodeURIComponent(connection.calendarId);
  const path = task.googleEventId
    ? `/calendars/${calendarId}/events/${encodeURIComponent(task.googleEventId)}?sendUpdates=none`
    : `/calendars/${calendarId}/events?sendUpdates=none`;
  const response = await googleFetch(companyAccountId, path, {
    method: task.googleEventId ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  const event = (await response.json()) as GoogleEvent & {
    error?: { message?: string };
  };
  if (!response.ok || !event.id) {
    await prisma.crmTask.update({
      where: { id: task.id },
      data: { calendarSyncStatus: 'ERROR' },
    });
    throw new Error(event.error?.message || 'Google takvim kaydı güncellenemedi.');
  }
  const syncedAt = new Date();
  await prisma.crmTask.update({
    where: { id: task.id },
    data: {
      googleCalendarId: connection.calendarId,
      googleEventId: event.id,
      googleUpdatedAt: event.updated ? new Date(event.updated) : syncedAt,
      calendarSyncedAt: syncedAt,
      calendarSyncStatus: 'SYNCED',
    },
  });
  return event;
}

function googleDate(value: GoogleEventDate | undefined) {
  if (value?.dateTime) return new Date(value.dateTime);
  if (value?.date) return new Date(`${value.date}T00:00:00+03:00`);
  return null;
}

export function classifyGoogleEvent(event: Pick<GoogleEvent, 'summary' | 'extendedProperties'>) {
  const explicit = event.extendedProperties?.private?.jasmineTaskType;
  if (explicit && Object.values(CrmTaskType).includes(explicit as CrmTaskType)) {
    return explicit as CrmTaskType;
  }
  const title = event.summary?.toLocaleLowerCase('tr-TR') || '';
  if (title.includes('gösterim') || title.includes('portföy gezisi')) {
    return CrmTaskType.VIEWING;
  }
  if (
    title.includes('randevu') ||
    title.includes('toplantı') ||
    title.includes('meeting')
  ) {
    return CrmTaskType.MEETING;
  }
  return CrmTaskType.OTHER;
}

async function listGoogleEvents(
  companyAccountId: string,
  connection: {
    calendarId: string;
    syncToken: string | null;
  },
  allowReset = true
) {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const params = new URLSearchParams({
      showDeleted: 'true',
      maxResults: '2500',
    });
    if (connection.syncToken) {
      params.set('syncToken', connection.syncToken);
    } else {
      params.set(
        'timeMin',
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      );
      params.set(
        'timeMax',
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      );
      params.set('singleEvents', 'true');
    }
    if (pageToken) params.set('pageToken', pageToken);
    const response = await googleFetch(
      companyAccountId,
      `/calendars/${encodeURIComponent(connection.calendarId)}/events?${params}`
    );
    if (response.status === 410 && allowReset) {
      await prisma.googleCalendarConnection.update({
        where: { companyAccountId },
        data: { syncToken: null },
      });
      return listGoogleEvents(
        companyAccountId,
        { ...connection, syncToken: null },
        false
      );
    }
    const data = (await response.json()) as GoogleEventList;
    if (!response.ok) {
      throw new Error(data.error?.message || 'Google etkinlikleri alınamadı.');
    }
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken || nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken };
}

export async function syncCompanyGoogleCalendar(companyAccountId: string) {
  const log = await prisma.calendarSyncLog.create({
    data: { companyAccountId, status: 'RUNNING' },
  });
  let pulledCount = 0;
  let pushedCount = 0;
  let conflictCount = 0;
  try {
    const connection = await prisma.googleCalendarConnection.update({
      where: { companyAccountId },
      data: { lastSyncStatus: 'SYNCING', lastSyncError: null },
    });
    const listed = await listGoogleEvents(companyAccountId, connection);
    for (const event of listed.events) {
      if (!event.id) continue;
      const jasmineTaskId =
        event.extendedProperties?.private?.jasmineTaskId || null;
      const local = await prisma.crmTask.findFirst({
        where: {
          companyAccountId,
          OR: [
            {
              googleCalendarId: connection.calendarId,
              googleEventId: event.id,
            },
            ...(jasmineTaskId ? [{ id: jasmineTaskId }] : []),
          ],
        },
      });
      const remoteUpdated = event.updated ? new Date(event.updated) : new Date();
      const remoteChanged =
        !local?.googleUpdatedAt ||
        remoteUpdated.getTime() > local.googleUpdatedAt.getTime();
      const localDirty =
        local?.calendarSyncStatus === 'PENDING' ||
        local?.calendarSyncStatus === 'LOCAL' ||
        local?.calendarSyncStatus === 'ERROR';

      if (local && localDirty && remoteChanged) {
        conflictCount += 1;
        if (local.updatedAt.getTime() >= remoteUpdated.getTime()) {
          continue;
        }
      }

      if (event.status === 'cancelled') {
        if (local && !localDirty) {
          await prisma.crmTask.update({
            where: { id: local.id },
            data: {
              status: CrmTaskStatus.CANCELLED,
              googleUpdatedAt: remoteUpdated,
              calendarSyncedAt: new Date(),
              calendarSyncStatus: 'SYNCED',
            },
          });
          pulledCount += 1;
        }
        continue;
      }

      const dueAt = googleDate(event.start);
      if (!dueAt) continue;
      const allDay = Boolean(event.start?.date);
      const taskData = {
        title: event.summary?.trim() || 'Google Calendar etkinliği',
        description: event.description?.trim() || null,
        dueAt,
        endAt: googleDate(event.end),
        allDay,
        type: classifyGoogleEvent(event),
        priority: Number(
          event.extendedProperties?.private?.jasminePriority || 2
        ),
        calendarSource: jasmineTaskId ? 'JASMINE' : 'GOOGLE',
        calendarSyncStatus: 'SYNCED',
        googleCalendarId: connection.calendarId,
        googleEventId: event.id,
        googleUpdatedAt: remoteUpdated,
        calendarSyncedAt: new Date(),
      };
      if (local) {
        await prisma.crmTask.update({
          where: { id: local.id },
          data: taskData,
        });
      } else {
        await prisma.crmTask.create({
          data: {
            companyAccountId,
            ...taskData,
          },
        });
      }
      pulledCount += 1;
    }

    const pendingTasks = await prisma.crmTask.findMany({
      where: {
        companyAccountId,
        dueAt: { not: null },
        status: { not: CrmTaskStatus.CANCELLED },
        calendarSyncStatus: { in: ['LOCAL', 'PENDING', 'ERROR'] },
      },
      select: { id: true },
      take: 250,
    });
    for (const task of pendingTasks) {
      await syncSingleTaskToGoogle(companyAccountId, task.id);
      pushedCount += 1;
    }

    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.googleCalendarConnection.update({
        where: { companyAccountId },
        data: {
          syncToken: listed.nextSyncToken || connection.syncToken,
          lastSyncedAt: finishedAt,
          lastSyncStatus: 'SYNCED',
          lastSyncError: null,
        },
      }),
      prisma.calendarSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          pulledCount,
          pushedCount,
          conflictCount,
          finishedAt,
        },
      }),
    ]);
    return { pulledCount, pushedCount, conflictCount, finishedAt };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Takvim senkronu tamamlanamadı.';
    await prisma.$transaction([
      prisma.googleCalendarConnection.updateMany({
        where: { companyAccountId },
        data: { lastSyncStatus: 'ERROR', lastSyncError: message },
      }),
      prisma.calendarSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'ERROR',
          pulledCount,
          pushedCount,
          conflictCount,
          errorMessage: message,
          finishedAt: new Date(),
        },
      }),
    ]);
    throw new Error(message);
  }
}

export async function deleteTaskFromGoogle(
  companyAccountId: string,
  task: { googleCalendarId: string | null; googleEventId: string | null }
) {
  if (!task.googleCalendarId || !task.googleEventId) return;
  const response = await googleFetch(
    companyAccountId,
    `/calendars/${encodeURIComponent(task.googleCalendarId)}/events/${encodeURIComponent(task.googleEventId)}?sendUpdates=none`,
    { method: 'DELETE' }
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error('Google Calendar etkinliği silinemedi.');
  }
}

export async function disconnectGoogleCalendar(companyAccountId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { companyAccountId },
  });
  if (!connection) return;
  const refreshToken = decryptCalendarToken(connection.encryptedRefreshToken);
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        cache: 'no-store',
      }
    );
  } catch {
    // Yerel bağlantı, Google iptal uç noktası geçici olarak erişilemese de kaldırılır.
  }
  await prisma.googleCalendarConnection.delete({
    where: { id: connection.id },
  });
  await prisma.crmTask.updateMany({
    where: { companyAccountId },
    data: {
      calendarSyncStatus: 'LOCAL',
      googleCalendarId: null,
      googleEventId: null,
      googleUpdatedAt: null,
      calendarSyncedAt: null,
    },
  });
}

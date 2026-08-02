import { CrmTaskType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildGoogleEventsQuery,
  buildTaskEventBody,
  classifyGoogleEvent,
} from './google-calendar';

describe('classifyGoogleEvent', () => {
  it('Jasmine özel türünü korur', () => {
    expect(
      classifyGoogleEvent({
        summary: 'Müşteri buluşması',
        extendedProperties: {
          private: { jasmineTaskType: CrmTaskType.VIEWING },
        },
      })
    ).toBe(CrmTaskType.VIEWING);
  });

  it('Google başlığından gösterim ve randevuyu ayırır', () => {
    expect(
      classifyGoogleEvent({
        summary: 'Kestel portföy gösterimi',
      })
    ).toBe(CrmTaskType.VIEWING);
    expect(
      classifyGoogleEvent({
        summary: 'Yeni müşteri randevusu',
      })
    ).toBe(CrmTaskType.MEETING);
  });

  it('bilinmeyen Google etkinliğini diğer olarak işaretler', () => {
    expect(classifyGoogleEvent({ summary: 'Ofis planı' })).toBe(
      CrmTaskType.OTHER
    );
  });
});

describe('Google Calendar senkron yardımcıları', () => {
  it('artımlı senkron sırasında tekrarlanan etkinlikleri tekil örnekler olarak ister', () => {
    const params = buildGoogleEventsQuery({
      syncToken: 'sync-token',
      pageToken: 'page-token',
    });

    expect(params.get('syncToken')).toBe('sync-token');
    expect(params.get('pageToken')).toBe('page-token');
    expect(params.get('singleEvents')).toBe('true');
    expect(params.get('showDeleted')).toBe('true');
  });

  it('Google etkinliğini şirket saat dilimiyle oluşturur', () => {
    const body = buildTaskEventBody(
      {
        id: 'task-1',
        title: 'Portföy gösterimi',
        description: null,
        dueAt: new Date('2026-08-03T09:00:00.000Z'),
        endAt: new Date('2026-08-03T10:00:00.000Z'),
        allDay: false,
        type: CrmTaskType.VIEWING,
        priority: 2,
      },
      'Europe/Berlin'
    );

    expect(body.start).toMatchObject({ timeZone: 'Europe/Berlin' });
    expect(body.end).toMatchObject({ timeZone: 'Europe/Berlin' });
  });
});

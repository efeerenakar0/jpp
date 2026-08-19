import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CalendarWorkspace, { type CalendarData } from './CalendarWorkspace';

function calendarFixture(): CalendarData {
  const today = new Date();
  today.setHours(10, 30, 0, 0);

  return {
    tasks: [
      {
        id: 'task-1',
        title: 'Portföy çekimi',
        type: 'VIEWING',
        description: 'Villa projesi çekim planlaması',
        dueAt: today.toISOString(),
        endAt: new Date(today.getTime() + 60 * 60_000).toISOString(),
        allDay: false,
        priority: 2,
        status: 'OPEN',
        calendarSource: 'JASMINE',
        calendarSyncStatus: 'LOCAL',
        contact: null,
        property: { id: 'property-1', title: 'Sahil villası', location: 'Bodrum' },
        deal: null,
        assignedMember: { id: 'member-1', name: 'Jasmine Demir' },
      },
    ],
    contacts: [],
    properties: [],
    deals: [],
    members: [{ id: 'member-1', name: 'Jasmine Demir' }],
    permissions: {
      canManageTeam: true,
      canManageSecrets: true,
      canViewSubscription: true,
      canEditReports: true,
    },
    google: {
      configured: false,
      connected: false,
      lastSyncedAt: null,
    },
    syncLogs: [],
    metrics: {
      today: 1,
      nextSevenDays: 4,
      appointments: 1,
      overdue: 1,
    },
  };
}

describe('CalendarWorkspace calendar dashboard', () => {
  it('renders the approved compact calendar rail without the team workload card', () => {
    const html = renderToStaticMarkup(
      <CalendarWorkspace initialCalendar={calendarFixture()} preview />
    );

    expect(html).toContain('Takvim özeti');
    expect(html).toContain('Bugünün ajandası');
    expect(html).toContain('Yaklaşanlar');
    expect(html).toContain('Hatırlatma');
    expect(html).toContain('Google kurulumu bekleniyor');
    expect(html).not.toContain('Takım iş yükü');
  });

  it('keeps calendar actions and Google connection controls available', () => {
    const html = renderToStaticMarkup(
      <CalendarWorkspace initialCalendar={calendarFixture()} preview />
    );

    expect(html).toContain('Yeni etkinlik');
    expect(html).toContain('Önceki tarih aralığı');
    expect(html).toContain('Sonraki tarih aralığı');
    expect(html).toContain('Google Takvim ayarlarını aç');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});

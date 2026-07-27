import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  fallbackGeneralManagerAnswer,
  generalManagerSuggestions,
  type GeneralManagerContext,
} from './general-manager-context';

const context = {
  generatedAt: '2026-07-27T20:00:00.000Z',
  company: {
    name: 'Jasmine Group',
    principalName: 'Efe',
    principalType: 'OWNER',
  },
  metrics: {
    activeProjects: 3,
    huntedListings: 6,
    authorizedListings: 2,
    pendingAppointments: 1,
    activeConversations: 4,
    unreadNotifications: 2,
    crmContacts: 7,
    activeCrmProperties: 3,
    openDeals: 2,
    overdueTasks: 1,
    upcomingTasks: 4,
    campaigns: 5,
    approvedCampaignCopies: 8,
  },
  priorities: [
    {
      id: 'task:1',
      severity: 'critical',
      title: 'Geciken görev · Ayşe Hanım’ı ara',
      detail: 'Efe sorumlu',
      href: '/fabrika/takvim',
    },
  ],
  crm: {
    contacts: [
      {
        name: 'Ayşe',
        score: 91,
        stage: 'QUALIFIED',
      },
    ],
  },
  portfolio: { properties: [] },
  sales: {
    deals: [
      {
        title: 'Kestel 3+1 satış',
        probability: 80,
        stage: 'OFFER',
      },
    ],
    matches: [],
  },
  calendar: { tasks: [], google: { connected: false } },
  marketing: { campaigns: [], websiteAnalyses: [] },
  activity: [],
  notifications: [],
  modules: [],
} as unknown as GeneralManagerContext;

describe('general manager context helpers', () => {
  it('prioritizes overdue tasks in suggested questions', () => {
    const suggestions = generalManagerSuggestions(context);
    expect(suggestions[0].label).toBe('Geciken görevler');
    expect(suggestions).toHaveLength(5);
  });

  it('returns grounded CRM information when live AI is unavailable', () => {
    const answer = fallbackGeneralManagerAnswer('En sıcak müşteriler kim?', context);
    expect(answer).toContain('7 müşteri');
    expect(answer).toContain('Ayşe: 91/100');
  });

  it('returns exact marketing counts without inventing results', () => {
    const answer = fallbackGeneralManagerAnswer('Kampanya durumu nedir?', context);
    expect(answer).toContain('5 kampanya');
    expect(answer).toContain('8 onaylı kanal metni');
  });
});

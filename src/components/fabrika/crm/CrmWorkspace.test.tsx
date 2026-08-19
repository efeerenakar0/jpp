import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CrmWorkspace from './CrmWorkspace';
import type { CrmWorkspaceData } from './crm-types';

const workspace: CrmWorkspaceData = {
  account: { id: 'account-a', companyName: 'Jasmine', ownerName: 'Patron' },
  permissions: {
    canManageTeam: true,
    canManageSecrets: true,
    canViewSubscription: true,
    canEditReports: true,
  },
  members: [],
  contacts: [{
    id: 'contact-a',
    name: 'Ada Müşteri',
    phone: '0555 111 22 33',
    email: 'ada@example.test',
    type: 'BUYER',
    stage: 'QUALIFIED',
    source: 'Referans',
    desiredLocation: 'Kadıköy',
    desiredRoomCount: '3+1',
    budgetMin: 8_000_000,
    budgetMax: 11_000_000,
    notes: 'Deniz ulaşımına yakın aile konutu arıyor.',
    tags: ['VIP'],
    score: 82,
    scoreReasons: ['Bütçe net', 'Takip güncel'],
    scoreSource: 'RULES',
    scoreUpdatedAt: '2026-08-19T10:00:00.000Z',
    consentStatus: 'GRANTED',
    nextActionAt: '2026-08-20T10:00:00.000Z',
    assignedMember: null,
    updatedAt: '2026-08-19T10:00:00.000Z',
  }],
  properties: [],
  deals: [],
  tasks: [],
  activities: [],
  matches: [],
  metrics: {
    contacts: 1,
    activeProperties: 0,
    openDeals: 0,
    overdueTasks: 0,
    upcomingCriticalTasks: 0,
    pipelineValue: 0,
    wonCommission: 0,
    averageMatchScore: 0,
  },
};

describe('CrmWorkspace', () => {
  it('renders the independent customer 360 workspace with accessible navigation', () => {
    const html = renderToStaticMarkup(
      <CrmWorkspace autoLoad={false} initialSection="customers" initialWorkspace={workspace} />
    );

    expect(html).toContain('JPP CRM 360');
    expect(html).toContain('Her müşteri için eksiksiz dijital dosya');
    expect(html).toContain('Ada Müşteri');
    expect(html).toContain('Müşteri puanı');
    expect(html).toContain('aria-label="CRM bölümleri"');
    expect(html).not.toContain('Şirket CEO');
  });

  it('renders the finance center as a first-class CRM section', () => {
    const html = renderToStaticMarkup(
      <CrmWorkspace autoLoad={false} initialSection="finance" initialWorkspace={workspace} />
    );

    expect(html).toContain('Borç, tahsilat, kapora ve komisyon tek ekstrede');
    expect(html).toContain('Denetlenebilir cari ekstre');
    expect(html).toContain('Cari hesap henüz boş');
  });
});

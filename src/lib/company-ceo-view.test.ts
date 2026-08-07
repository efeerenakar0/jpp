import { describe, expect, it } from 'vitest';
import { buildCompanyCeoSnapshot } from '@/lib/company-ceo-view';

describe('AI Şirket CEO görünümü', () => {
  it('yalnız doğrulanmış tenant uçlarından gelen sayıları özetler', () => {
    const snapshot = buildCompanyCeoSnapshot(
      {
        metrics: {
          contacts: 12,
          activeProperties: 7,
          openDeals: 4,
          overdueTasks: 2,
          upcomingCriticalTasks: 3,
          pipelineValue: 8_250_000,
          wonCommission: 210_000,
          averageMatchScore: 78,
        },
        members: [
          {
            id: 'member-1',
            name: 'Efe',
            active: true,
            monthlyPerformance: {
              completedTasks: 8,
              openTasks: 2,
              wonDeals: 1,
              newProperties: 3,
            },
          },
        ],
        tasks: [],
      },
      {
        approvals: [{ id: 'approval-1', reason: 'Yayın onayı bekliyor' }],
        commitments: [],
        deliveries: [],
        summary: { generatedText: 'Bugün iki kritik görev takip edilmeli.' },
      },
      [
        { id: 'campaign-1', publicationStatus: 'DRAFT' },
        { id: 'campaign-2', publicationStatus: 'MANUALLY_CONFIRMED' },
      ],
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(snapshot.metrics).toMatchObject({
      customers: 12,
      portfolios: 7,
      opportunities: 4,
      overdueTasks: 2,
      campaigns: 2,
      manuallyConfirmedCampaigns: 1,
    });
    expect(snapshot.employeePerformance[0]).toMatchObject({
      name: 'Efe',
      completedTasks: 8,
      wonDeals: 1,
    });
    expect(snapshot.criticalAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'APPROVAL' }),
        expect.objectContaining({ kind: 'OVERDUE_TASKS' }),
      ]),
    );
    expect(snapshot.report).toContain('iki kritik görev');
  });

  it('teslimat hatası ve gecikmiş taahhüdü kritik listede gösterir', () => {
    const snapshot = buildCompanyCeoSnapshot(
      {
        metrics: {
          contacts: 0,
          activeProperties: 0,
          openDeals: 0,
          overdueTasks: 0,
          upcomingCriticalTasks: 0,
          pipelineValue: 0,
          wonCommission: 0,
          averageMatchScore: 0,
        },
        members: [],
        tasks: [],
      },
      {
        approvals: [],
        commitments: [
          { id: 'commitment-1', status: 'OVERDUE', description: 'Müşteri dönüşü' },
        ],
        deliveries: [
          { id: 'delivery-1', status: 'FAILED', purpose: 'Çalışan bildirimi' },
        ],
        summary: null,
      },
      [],
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(snapshot.criticalAlerts.map(({ kind }) => kind)).toEqual([
      'DELIVERY_FAILED',
      'COMMITMENT_OVERDUE',
    ]);
    expect(snapshot.report).toBe('Henüz doğrulanmış yönetici özeti oluşmadı.');
  });
});

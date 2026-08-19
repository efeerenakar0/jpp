import { describe, expect, it } from "vitest";
import {
  buildCompanyCeoSnapshot,
  buildThirtyDayOutlook,
} from "@/lib/company-ceo-view";

describe("AI Şirket CEO görünümü", () => {
  it("yalnız doğrulanmış tenant uçlarından gelen sayıları özetler", () => {
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
            id: "member-1",
            name: "Efe",
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
        approvals: [{ id: "approval-1", reason: "Yayın onayı bekliyor" }],
        commitments: [],
        deliveries: [],
        summary: { generatedText: "Bugün iki kritik görev takip edilmeli." },
      },
      [
        { id: "campaign-1", publicationStatus: "DRAFT" },
        { id: "campaign-2", publicationStatus: "MANUALLY_CONFIRMED" },
      ],
      new Date("2026-08-06T12:00:00.000Z"),
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
      name: "Efe",
      completedTasks: 8,
      wonDeals: 1,
    });
    expect(snapshot.criticalAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "APPROVAL" }),
        expect.objectContaining({ kind: "OVERDUE_TASKS" }),
      ]),
    );
    expect(snapshot.report).toContain("iki kritik görev");
  });

  it("teslimat hatası ve gecikmiş taahhüdü kritik listede gösterir", () => {
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
          {
            id: "commitment-1",
            status: "OVERDUE",
            description: "Müşteri dönüşü",
          },
        ],
        deliveries: [
          { id: "delivery-1", status: "FAILED", purpose: "Çalışan bildirimi" },
        ],
        summary: null,
      },
      [],
      new Date("2026-08-06T12:00:00.000Z"),
    );

    expect(snapshot.criticalAlerts.map(({ kind }) => kind)).toEqual([
      "DELIVERY_FAILED",
      "COMMITMENT_OVERDUE",
    ]);
    expect(snapshot.report).toBe("Henüz doğrulanmış yönetici özeti oluşmadı.");
  });

  it("30 günlük görünümü yalnız tarihli ve finansal bilgisi tam fırsatlardan hesaplar", () => {
    const outlook = buildThirtyDayOutlook(
      [
        {
          id: "deal-1",
          title: "Boğaz hattı portföyü",
          stage: "OFFER",
          estimatedValue: 10_000_000,
          commissionRate: 2,
          probability: 80,
          expectedCloseAt: new Date("2026-08-30T12:00:00.000Z"),
        },
        {
          id: "deal-2",
          title: "Tarihi eksik fırsat",
          stage: "QUALIFIED",
          estimatedValue: 5_000_000,
          commissionRate: 2,
          probability: 45,
          expectedCloseAt: null,
        },
        {
          id: "deal-3",
          title: "Dönem dışı fırsat",
          stage: "CONTRACT",
          estimatedValue: 4_000_000,
          commissionRate: 2,
          probability: 90,
          expectedCloseAt: new Date("2026-10-15T12:00:00.000Z"),
        },
        {
          id: "deal-4",
          title: "Kapanmış fırsat",
          stage: "WON",
          estimatedValue: 3_000_000,
          commissionRate: 2,
          probability: 100,
          expectedCloseAt: new Date("2026-08-25T12:00:00.000Z"),
        },
      ],
      new Date("2026-08-19T12:00:00.000Z"),
    );

    expect(outlook).toMatchObject({
      status: "available",
      openDealCount: 3,
      eligibleDealCount: 1,
      dataCoverage: 33,
      confidence: "low",
      expectedCommission: 160_000,
      conservativeCommission: 130_000,
      optimisticCommission: 190_000,
      missingExpectedCloseAt: 1,
    });
    expect(outlook.topOpportunities).toEqual([
      expect.objectContaining({
        id: "deal-1",
        weightedCommission: 160_000,
      }),
    ]);
  });

  it("yeterli veri yoksa rakam uydurmak yerine hazırlık durumunu döndürür", () => {
    const outlook = buildThirtyDayOutlook(
      [
        {
          id: "deal-1",
          title: "Eksik kayıt",
          stage: "NEW",
          estimatedValue: null,
          commissionRate: 2,
          probability: 20,
          expectedCloseAt: null,
        },
      ],
      new Date("2026-08-19T12:00:00.000Z"),
    );

    expect(outlook.status).toBe("insufficient_data");
    expect(outlook.expectedCommission).toBe(0);
    expect(outlook.dataCoverage).toBe(0);
    expect(outlook.missingExpectedCloseAt).toBe(1);
    expect(outlook.missingFinancials).toBe(1);
  });
});

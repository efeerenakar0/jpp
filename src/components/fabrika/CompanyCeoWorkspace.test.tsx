import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildCompanyCeoSnapshot } from "@/lib/company-ceo-view";

vi.mock("@/components/fabrika/WorkspacePage", () => ({
  default: () => <div>CRM çalışma alanı</div>,
}));

import CompanyCeoWorkspace from "./CompanyCeoWorkspace";

describe("CompanyCeoWorkspace", () => {
  it("karar odaklı CEO görünümünü ve açıklanabilir 30 günlük hesabı gösterir", () => {
    const snapshot = buildCompanyCeoSnapshot(
      {
        account: { companyName: "JPP Gayrimenkul" },
        metrics: {
          contacts: 24,
          activeProperties: 11,
          openDeals: 2,
          overdueTasks: 1,
          upcomingCriticalTasks: 3,
          pipelineValue: 15_000_000,
          wonCommission: 220_000,
          averageMatchScore: 81,
        },
        members: [
          {
            id: "member-1",
            name: "Ece",
            active: true,
            monthlyPerformance: {
              completedTasks: 12,
              openTasks: 3,
              wonDeals: 2,
              newProperties: 4,
            },
          },
        ],
        deals: [
          {
            id: "deal-1",
            title: "Sahil portföyü",
            stage: "OFFER",
            estimatedValue: 10_000_000,
            commissionRate: 2,
            probability: 80,
            expectedCloseAt: new Date("2026-08-30T12:00:00.000Z"),
          },
          {
            id: "deal-2",
            title: "Merkez ofis",
            stage: "QUALIFIED",
            estimatedValue: 5_000_000,
            commissionRate: 2,
            probability: 45,
            expectedCloseAt: new Date("2026-09-03T12:00:00.000Z"),
          },
        ],
        tasks: [],
      },
      {
        approvals: [{ id: "approval-1", reason: "Fiyat onayı" }],
        commitments: [],
        deliveries: [],
        summary: {
          generatedText: "Bugün fiyat onayı ve sıcak fırsatlar öncelikli.",
        },
      },
      [],
      new Date("2026-08-19T12:00:00.000Z"),
    );

    const html = renderToStaticMarkup(
      <CompanyCeoWorkspace initialSnapshot={snapshot} />,
    );

    expect(html).toContain("Bugün neye odaklanmanız gerektiğini görün.");
    expect(html).toContain("JPP Gayrimenkul");
    expect(html).toContain("AI yönetici brifingi");
    expect(html).toContain("30 Günlük Görünüm");
    expect(html).toContain("Olasılık ağırlıklı komisyon");
    expect(html).toContain("CRM olasılıkları hesaplar");
    expect(html).toContain("CEO karar kutusu");
    expect(html).toContain("Sahil portföyü");
    expect(html).toContain("Fırsatlar hangi aşamada?");
    expect(html).toContain("Ekip nabzı");
    expect(html).toContain('href="/fabrika/portfoyler"');
  });

  it("veri yüklenirken stabil iskelet görünümünü korur", () => {
    const html = renderToStaticMarkup(<CompanyCeoWorkspace />);

    expect(html).toContain("Şirket özeti yükleniyor");
    expect(html).toContain("Yenile");
    expect(html).toContain("Kararları incele");
  });
});

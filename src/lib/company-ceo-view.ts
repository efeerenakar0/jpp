import { z } from 'zod';

const performanceSchema = z.object({
  completedTasks: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  wonDeals: z.number().int().nonnegative(),
  newProperties: z.number().int().nonnegative(),
});

export const companyCeoWorkspaceSchema = z.object({
  metrics: z.object({
    contacts: z.number().int().nonnegative(),
    activeProperties: z.number().int().nonnegative(),
    openDeals: z.number().int().nonnegative(),
    overdueTasks: z.number().int().nonnegative(),
    upcomingCriticalTasks: z.number().int().nonnegative(),
    pipelineValue: z.number().nonnegative(),
    wonCommission: z.number().nonnegative(),
    averageMatchScore: z.number().nonnegative(),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      active: z.boolean(),
      monthlyPerformance: performanceSchema,
    }).passthrough(),
  ),
  tasks: z.array(z.object({ id: z.string() }).passthrough()),
}).passthrough();

export const companyCeoManagerSchema = z.object({
  approvals: z.array(
    z.object({ id: z.string(), reason: z.string().nullish() }).passthrough(),
  ),
  commitments: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      description: z.string(),
    }).passthrough(),
  ),
  deliveries: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      purpose: z.string().nullish(),
    }).passthrough(),
  ),
  summary: z.object({ generatedText: z.string() }).passthrough().nullish(),
}).passthrough();

export const companyCeoCampaignSchema = z.object({
  id: z.string(),
  publicationStatus: z.string().nullish(),
}).passthrough();

export const companyCeoMarketingSchema = z.object({
  campaigns: z.array(companyCeoCampaignSchema),
}).passthrough();

export type CompanyCeoWorkspace = z.infer<typeof companyCeoWorkspaceSchema>;
export type CompanyCeoManager = z.infer<typeof companyCeoManagerSchema>;
export type CompanyCeoCampaign = z.infer<typeof companyCeoCampaignSchema>;

export type CompanyCeoCriticalAlert = {
  id: string;
  kind:
    | 'DELIVERY_FAILED'
    | 'COMMITMENT_OVERDUE'
    | 'APPROVAL'
    | 'OVERDUE_TASKS';
  title: string;
  detail: string;
};

export function buildCompanyCeoSnapshot(
  workspace: CompanyCeoWorkspace,
  manager: CompanyCeoManager,
  campaigns: CompanyCeoCampaign[],
  now = new Date(),
) {
  const criticalAlerts: CompanyCeoCriticalAlert[] = [];

  for (const delivery of manager.deliveries) {
    if (!['FAILED', 'DEAD_LETTER'].includes(delivery.status)) continue;
    criticalAlerts.push({
      id: delivery.id,
      kind: 'DELIVERY_FAILED',
      title: 'İletişim teslim edilemedi',
      detail: delivery.purpose || 'İlgili operasyon mesajını kontrol edin.',
    });
  }

  for (const commitment of manager.commitments) {
    if (commitment.status !== 'OVERDUE') continue;
    criticalAlerts.push({
      id: commitment.id,
      kind: 'COMMITMENT_OVERDUE',
      title: 'Taahhüt gecikti',
      detail: commitment.description,
    });
  }

  for (const approval of manager.approvals) {
    criticalAlerts.push({
      id: approval.id,
      kind: 'APPROVAL',
      title: 'Patron onayı bekleniyor',
      detail: approval.reason || 'Karar ayrıntısını inceleyin.',
    });
  }

  if (workspace.metrics.overdueTasks > 0) {
    criticalAlerts.push({
      id: `overdue-tasks:${now.toISOString().slice(0, 10)}`,
      kind: 'OVERDUE_TASKS',
      title: `${workspace.metrics.overdueTasks} görev gecikti`,
      detail: 'Takvim ve görev sorumlularını kontrol edin.',
    });
  }

  const employeePerformance = workspace.members
    .filter((member) => member.active)
    .map((member) => ({
      id: member.id,
      name: member.name,
      ...member.monthlyPerformance,
    }))
    .sort((left, right) => right.completedTasks - left.completedTasks);

  const manuallyConfirmedCampaigns = campaigns.filter(
    (campaign) => campaign.publicationStatus === 'MANUALLY_CONFIRMED',
  ).length;

  return {
    generatedAt: now.toISOString(),
    metrics: {
      customers: workspace.metrics.contacts,
      portfolios: workspace.metrics.activeProperties,
      opportunities: workspace.metrics.openDeals,
      overdueTasks: workspace.metrics.overdueTasks,
      upcomingCriticalTasks: workspace.metrics.upcomingCriticalTasks,
      pipelineValue: workspace.metrics.pipelineValue,
      wonCommission: workspace.metrics.wonCommission,
      averageMatchScore: workspace.metrics.averageMatchScore,
      campaigns: campaigns.length,
      manuallyConfirmedCampaigns,
    },
    employeePerformance,
    criticalAlerts,
    report:
      manager.summary?.generatedText.trim() ||
      'Henüz doğrulanmış yönetici özeti oluşmadı.',
  };
}

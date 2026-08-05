type CustomerWebsiteVersionSource = {
  [key: string]: unknown;
  id: string;
  version: number;
  resultFileName?: string | null;
  resultSha256?: string | null;
  qaStatus: string;
  previewUrl?: string | null;
  finalUrl?: string | null;
  approvedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
};

type CustomerWebsiteIntegrationSource = {
  [key: string]: unknown;
  id: string;
  displayName: string;
  websiteUrl: string;
  framework: string;
  hostingProvider: string;
  portfolioPath: string;
  technicalContactEmail: string;
  repositoryUrl?: string | null;
  notes?: string | null;
  sourceFileName: string;
  sourceSize: number;
  status: string;
  deliveryType?: string | null;
  previewUrl?: string | null;
  finalUrl?: string | null;
  approvedAt?: Date | string | null;
  lastError?: string | null;
  submittedAt: Date | string;
  deliveredAt?: Date | string | null;
  versions?: CustomerWebsiteVersionSource[];
};

/**
 * Explicit customer allowlist. API-key metadata, prompts, work orders and
 * private blob paths must remain on the platform-admin surface.
 */
export function toCustomerWebsiteIntegration(
  integration: CustomerWebsiteIntegrationSource
) {
  return {
    id: integration.id,
    displayName: integration.displayName,
    websiteUrl: integration.websiteUrl,
    framework: integration.framework,
    hostingProvider: integration.hostingProvider,
    portfolioPath: integration.portfolioPath,
    technicalContactEmail: integration.technicalContactEmail,
    repositoryUrl: integration.repositoryUrl ?? null,
    notes: integration.notes ?? null,
    sourceFileName: integration.sourceFileName,
    sourceSize: integration.sourceSize,
    status: integration.status,
    deliveryType: integration.deliveryType ?? null,
    previewUrl: integration.previewUrl ?? null,
    finalUrl: integration.finalUrl ?? null,
    approvedAt: integration.approvedAt ?? null,
    lastError: integration.lastError ?? null,
    submittedAt: integration.submittedAt,
    deliveredAt: integration.deliveredAt ?? null,
    versions: (integration.versions ?? []).map((version) => ({
      id: version.id,
      version: version.version,
      resultFileName: version.resultFileName ?? null,
      resultSha256: version.resultSha256 ?? null,
      qaStatus: version.qaStatus,
      previewUrl: version.previewUrl ?? null,
      finalUrl: version.finalUrl ?? null,
      approvedAt: version.approvedAt ?? null,
      deliveredAt: version.deliveredAt ?? null,
    })),
  };
}

export const businessCeoBrand = {
  productName: 'Business CEO AI',
  shortName: 'BCEO',
  panelName: 'CEO Workspace',
  assistantName: 'CEO Copilot',
  descriptor: 'Akıllı Gayrimenkul Operasyon Sistemi',
} as const;

const legacyDefaultNames = new Set([
  '',
  'jasmine ai',
  'jasmine ai fabrikası',
  'jasmine proje pazarlama',
]);

/**
 * Gerçek müşteri şirketlerinin tenant adlarını korur; yalnızca ürünün eski
 * varsayılan marka adlarını Business CEO AI kimliğine taşır.
 */
export function resolveWorkspaceBrand(companyName?: string | null) {
  const normalized = companyName?.trim() ?? '';
  return legacyDefaultNames.has(normalized.toLowerCase())
    ? businessCeoBrand.productName
    : normalized;
}

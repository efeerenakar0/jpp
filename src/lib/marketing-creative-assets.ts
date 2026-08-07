export type MarketingCreativeAsset = {
  id: string;
  kind: 'POSTER' | 'VIDEO';
  propertyId: string;
  title: string;
  detail: string | null;
  previewUrl: string;
  downloadUrl: string;
  ratio: string | null;
  durationSeconds: number | null;
  createdAt: string;
  property: {
    id: string;
    title: string;
    referenceCode: string | null;
  };
};

function compactText(value: string | null | undefined, maxLength: number) {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function creativeAssetBelongsToProperty(
  asset: Pick<MarketingCreativeAsset, 'propertyId'>,
  propertyId: string
) {
  return asset.propertyId === propertyId;
}

export function buildCreativeAssetPromptContext(
  asset: MarketingCreativeAsset | null
) {
  if (!asset) return 'Seçilmiş bir Stüdyo/Reklam Tasarımı çalışması yok.';

  const parts = [
    `Çalışma türü: ${asset.kind}`,
    `Çalışma adı: ${compactText(asset.title, 180)}`,
    asset.ratio ? `Format: ${compactText(asset.ratio, 30)}` : null,
    asset.durationSeconds
      ? `Video süresi: ${asset.durationSeconds} saniye`
      : null,
    asset.detail
      ? `Kreatif brief: ${compactText(asset.detail, 1_200)}`
      : null,
  ].filter(Boolean);

  return parts.join('\n').slice(0, 1_800);
}

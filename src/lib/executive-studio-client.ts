import type { ExecutivePortfolioMedia } from './executive-portfolio-workflow';

export type ExecutiveStudioBatchItem = {
  id: string;
  originalUrl: string;
  originalFileName: string;
  outputUrl: string | null;
  outputFileName: string | null;
  status:
    | 'PENDING'
    | 'UPLOADING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'ATTACHED';
  errorMessage: string | null;
  attachedMediaId: string | null;
};

const statusDisplay = {
  PENDING: { status: 'queued', progress: 10 },
  UPLOADING: { status: 'uploading', progress: 35 },
  PROCESSING: { status: 'processing', progress: 70 },
  COMPLETED: { status: 'ready', progress: 100 },
  ATTACHED: { status: 'ready', progress: 100 },
  FAILED: { status: 'error', progress: 70 },
} as const;

export function mapStudioBatchItems(
  items: ExecutiveStudioBatchItem[],
  previousMedia: ExecutivePortfolioMedia[] = []
): ExecutivePortfolioMedia[] {
  const previousById = new Map(previousMedia.map((media) => [media.id, media]));

  return items.map((item) => {
    const previous = previousById.get(item.id);
    const display = statusDisplay[item.status];
    const restoredToOriginal = previous?.restoredToOriginal ?? false;
    const previewUrl = restoredToOriginal
      ? item.originalUrl
      : item.outputUrl || item.originalUrl;

    return {
      id: item.id,
      name: item.outputFileName || item.originalFileName,
      size: previous?.size ?? 0,
      progress: display.progress,
      status: display.status,
      error: item.errorMessage || undefined,
      removed: previous?.removed ?? false,
      restoredToOriginal,
      previewUrl,
      originalUrl: item.originalUrl,
      outputUrl: item.outputUrl || undefined,
      attachedMediaId: item.attachedMediaId || undefined,
    };
  });
}

export function isExecutiveStudioBatchTerminal(
  items: ExecutiveStudioBatchItem[]
) {
  return (
    items.length > 0 &&
    items.every((item) =>
      ['COMPLETED', 'FAILED', 'ATTACHED'].includes(item.status)
    )
  );
}

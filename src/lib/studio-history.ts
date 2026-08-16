export type StudioHistoryBatchStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'ATTACHED';

export type StudioHistoryItemStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ATTACHED';

export function summarizeStudioBatchHistory(input: {
  batchStatus: StudioHistoryBatchStatus;
  itemStatuses: StudioHistoryItemStatus[];
}) {
  const completed = input.itemStatuses.filter((status) =>
    ['COMPLETED', 'ATTACHED'].includes(status)
  ).length;
  const failed = input.itemStatuses.filter((status) => status === 'FAILED').length;
  const progress = input.itemStatuses.length
    ? Math.round(((completed + failed) / input.itemStatuses.length) * 100)
    : 0;
  const ready =
    completed > 0 &&
    ['COMPLETED', 'PARTIAL', 'ATTACHED'].includes(input.batchStatus);
  const openable = ready || failed > 0;
  const label = ready
    ? 'Hazır'
    : input.batchStatus === 'FAILED'
      ? 'Başarısız'
      : input.batchStatus === 'PROCESSING'
        ? 'İşleniyor'
        : 'Sırada';

  return { completed, failed, progress, ready, openable, label };
}

type StudioHistoryProperty = {
  id: string;
  title: string;
  location: string | null;
} | null;

type StudioHistoryBatchItem = {
  id: string;
  title?: string | null;
  status: StudioHistoryItemStatus;
  originalFileName: string;
  originalUrl: string;
  outputUrl: string | null;
  outputFileName: string | null;
  attachedMediaId: string | null;
};

export type StudioHistoryBatchInput = {
  id: string;
  title?: string | null;
  status: StudioHistoryBatchStatus;
  createdAt: string;
  property: StudioHistoryProperty;
  items: StudioHistoryBatchItem[];
};

export type StudioHistoryEntry = {
  id: string;
  batchId: string;
  batchTitle: string;
  createdAt: string;
  property: StudioHistoryProperty;
  source: 'portfolio' | 'computer';
  itemCount: number;
  itemIds: string[];
  readyItemIds: string[];
  attachableItemIds: string[];
  allReadyItemsAttached: boolean;
  originalUrl: string;
  outputUrl: string | null;
  searchableText: string;
  summary: ReturnType<typeof summarizeStudioBatchHistory>;
};

function historyFileTitle(fileName: string) {
  return (
    fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
    'Yeni fotoğraf çalışması'
  );
}

export function groupStudioBatchHistory(
  batches: StudioHistoryBatchInput[]
): StudioHistoryEntry[] {
  return batches.map((batch) => {
    const summary = summarizeStudioBatchHistory({
      batchStatus: batch.status,
      itemStatuses: batch.items.map((item) => item.status),
    });
    const readyItems = batch.items.filter(
      (item) =>
        Boolean(item.outputUrl) &&
        (item.status === 'COMPLETED' || item.status === 'ATTACHED')
    );
    const previewItem = readyItems[0] || batch.items[0];
    const batchTitle =
      batch.title?.trim() ||
      batch.property?.title ||
      batch.items.find((item) => item.title?.trim())?.title?.trim() ||
      historyFileTitle(batch.items[0]?.originalFileName || '');
    const attachableItemIds = readyItems
      .filter((item) => !item.attachedMediaId)
      .map((item) => item.id);

    return {
      id: batch.id,
      batchId: batch.id,
      batchTitle,
      createdAt: batch.createdAt,
      property: batch.property,
      source: batch.property ? 'portfolio' : 'computer',
      itemCount: batch.items.length,
      itemIds: batch.items.map((item) => item.id),
      readyItemIds: readyItems.map((item) => item.id),
      attachableItemIds,
      allReadyItemsAttached:
        readyItems.length > 0 && readyItems.every((item) => Boolean(item.attachedMediaId)),
      originalUrl: previewItem?.originalUrl || '',
      outputUrl: previewItem?.outputUrl || null,
      searchableText: [
        batchTitle,
        batch.property?.location,
        ...batch.items.map((item) => item.originalFileName),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR'),
      summary,
    };
  });
}

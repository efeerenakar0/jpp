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

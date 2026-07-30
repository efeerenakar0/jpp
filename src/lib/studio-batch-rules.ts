export type StudioBatchItemState =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ATTACHED';

export type StudioBatchState =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIAL'
  | 'ATTACHED';

export function summarizeStudioBatch(
  states: StudioBatchItemState[]
): StudioBatchState {
  if (!states.length || states.every((state) => state === 'PENDING')) {
    return 'PENDING';
  }
  if (states.every((state) => state === 'ATTACHED')) return 'ATTACHED';
  if (states.some((state) => state === 'PROCESSING')) return 'PROCESSING';
  if (states.some((state) => state === 'UPLOADING')) return 'UPLOADING';

  const completed = states.filter(
    (state) => state === 'COMPLETED' || state === 'ATTACHED'
  ).length;
  const failed = states.filter((state) => state === 'FAILED').length;
  if (failed === states.length) return 'FAILED';
  if (completed && failed) return 'PARTIAL';
  if (completed === states.length) return 'COMPLETED';
  return 'PENDING';
}

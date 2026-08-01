export type StudioBatchFailure = {
  name: string;
  message: string;
};

export type StudioBatchProgress = {
  completed: number;
  total: number;
  name: string;
};

export async function processStudioBatch<TItem, TResult>({
  items,
  getName,
  process,
  onProgress,
}: {
  items: readonly TItem[];
  getName: (item: TItem) => string;
  process: (item: TItem, index: number) => Promise<TResult>;
  onProgress?: (progress: StudioBatchProgress) => void;
}) {
  const successes: TResult[] = [];
  const failures: StudioBatchFailure[] = [];

  for (const [index, item] of items.entries()) {
    const name = getName(item);
    try {
      successes.push(await process(item, index));
    } catch (error) {
      failures.push({
        name,
        message:
          error instanceof Error
            ? error.message
            : 'Görsel işlenemedi. Lütfen yeniden deneyin.',
      });
    } finally {
      onProgress?.({
        completed: index + 1,
        total: items.length,
        name,
      });
    }
  }

  return { successes, failures };
}

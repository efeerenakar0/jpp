export const STUDIO_PROCESSING_CONCURRENCY = 5;

export async function runStudioProcessingQueue<T, R>(input: {
  items: readonly T[];
  process: (item: T, index: number) => Promise<R>;
  onSettled?: (
    result: PromiseSettledResult<R>,
    item: T,
    index: number
  ) => void;
  concurrency?: number;
}) {
  const results = new Array<PromiseSettledResult<R>>(input.items.length);
  const concurrency = Math.max(
    1,
    Math.min(
      STUDIO_PROCESSING_CONCURRENCY,
      Math.floor(input.concurrency ?? STUDIO_PROCESSING_CONCURRENCY),
      input.items.length || 1
    )
  );
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < input.items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = input.items[index];
      let result: PromiseSettledResult<R>;
      try {
        result = { status: 'fulfilled', value: await input.process(item, index) };
      } catch (reason) {
        result = { status: 'rejected', reason };
      }
      results[index] = result;
      input.onSettled?.(result, item, index);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

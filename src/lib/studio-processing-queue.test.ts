import { describe, expect, it, vi } from 'vitest';

import {
  runStudioProcessingQueue,
  STUDIO_PROCESSING_CONCURRENCY,
} from './studio-processing-queue';

describe('Studio processing queue', () => {
  it('processes every photo separately and never exceeds five concurrent calls', async () => {
    let active = 0;
    let maximumActive = 0;
    const gates = Array.from({ length: 12 }, () => Promise.withResolvers<void>());
    const process = vi.fn(async (item: number) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await gates[item].promise;
      active -= 1;
      return item * 2;
    });
    const running = runStudioProcessingQueue({
      items: Array.from({ length: 12 }, (_, index) => index),
      process,
    });

    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(5));
    expect(maximumActive).toBe(STUDIO_PROCESSING_CONCURRENCY);
    gates.slice(0, 5).forEach((gate) => gate.resolve());
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(10));
    gates.slice(5, 10).forEach((gate) => gate.resolve());
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(12));
    gates.slice(10).forEach((gate) => gate.resolve());

    const results = await running;
    expect(results).toHaveLength(12);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(maximumActive).toBe(5);
  });

  it('continues the remaining photos when one request fails', async () => {
    const onSettled = vi.fn();
    const results = await runStudioProcessingQueue({
      items: [1, 2, 3],
      process: async (item) => {
        if (item === 2) throw new Error('provider failed');
        return item;
      },
      onSettled,
    });

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect(onSettled).toHaveBeenCalledTimes(3);
  });
});

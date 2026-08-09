import 'server-only';

type HuntWorkerRuntimeOptions = {
  runNext: () => Promise<unknown>;
  wait: (milliseconds: number) => Promise<unknown>;
  pollMs: number;
  runOnce: boolean;
  shouldStop: () => boolean;
  reportError: (error: unknown) => void;
};

type WorkerRuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function shouldRunHuntWorkerOnce(
  env: WorkerRuntimeEnvironment = process.env
) {
  return env.AVCI_RUN_ONCE === 'true' || Boolean(env.ACTOR_RUN_ID);
}

export async function runHuntWorker(options: HuntWorkerRuntimeOptions) {
  if (options.runOnce) {
    try {
      await options.runNext();
    } catch (error) {
      options.reportError(error);
      throw error;
    }
    return;
  }

  while (!options.shouldStop()) {
    try {
      const result = await options.runNext();
      if (!result && !options.shouldStop()) {
        await options.wait(options.pollMs);
      }
    } catch (error) {
      options.reportError(error);
      if (!options.shouldStop()) {
        await options.wait(options.pollMs);
      }
    }
  }
}

import { Actor } from 'apify';
import { runNextHuntJob } from '../../src/lib/hunting-v2/worker';
import {
  runHuntWorker,
  shouldRunHuntWorkerOnce,
} from '../../src/lib/hunting-v2/worker-runtime';

const pollMs = Math.max(
  1_000,
  Math.min(60_000, Number(process.env.AVCI_WORKER_POLL_MS || 5_000))
);
let shutdownRequested = false;

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    shutdownRequested = true;
    process.stdout.write(
      `Business AI Portföy Uzmanı worker ${signal} aldı; mevcut işten sonra duracak.\n`
    );
  });
}

async function main() {
  process.stdout.write('Business AI Portföy Uzmanı worker başlatıldı.\n');
  await runHuntWorker({
    runNext: runNextHuntJob,
    wait: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    pollMs,
    runOnce: shouldRunHuntWorkerOnce(),
    shouldStop: () => shutdownRequested,
    reportError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Worker hatası';
      process.stderr.write(`Avcı worker işi başarısız: ${message}\n`);
    },
  });
  process.stdout.write('Business AI Portföy Uzmanı worker güvenli biçimde durdu.\n');
}

if (process.env.ACTOR_RUN_ID) {
  Actor.main(main).catch(() => {
    process.exitCode = 1;
  });
} else {
  main().catch(() => {
    process.exitCode = 1;
  });
}

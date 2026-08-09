import { runNextHuntJob } from '../../src/lib/hunting-v2/worker';

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
  while (!shutdownRequested) {
    try {
      const result = await runNextHuntJob();
      if (!result && !shutdownRequested) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Worker hatası';
      process.stderr.write(`Avcı worker işi başarısız: ${message}\n`);
      if (!shutdownRequested) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    }
  }
  process.stdout.write('Business AI Portföy Uzmanı worker güvenli biçimde durdu.\n');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Worker başlatılamadı';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

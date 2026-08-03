import { runNextHuntJob } from '../../src/lib/hunting-v2/worker';

const pollMs = Math.max(
  1_000,
  Math.min(60_000, Number(process.env.AVCI_WORKER_POLL_MS || 5_000))
);

async function main() {
  process.stdout.write('Business AI Portföy Bulucu worker başlatıldı.\n');
  while (true) {
    try {
      const result = await runNextHuntJob();
      if (!result) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Worker hatası';
      process.stderr.write(`Avcı worker işi başarısız: ${message}\n`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Worker başlatılamadı';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

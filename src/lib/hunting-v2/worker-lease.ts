type WorkerEnvironment = Readonly<Record<string, string | undefined>>;

function staleMilliseconds(environment: WorkerEnvironment) {
  const parsed = Number(environment.AVCI_WORKER_STALE_MS);
  if (!Number.isFinite(parsed)) return 300_000;
  return Math.min(3_600_000, Math.max(60_000, Math.trunc(parsed)));
}

export function buildWorkerLease(
  now = new Date(),
  environment: WorkerEnvironment = process.env
) {
  const staleBefore = new Date(now.getTime() - staleMilliseconds(environment));
  return {
    now,
    staleBefore,
    candidateWhere: {
      OR: [
        { status: 'QUEUED' as const },
        {
          status: 'RUNNING' as const,
          lastHeartbeatAt: { lt: staleBefore },
        },
      ],
    },
  };
}

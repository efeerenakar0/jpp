import { performance } from 'node:perf_hooks';
import { RobotsTxtFile } from '@crawlee/utils';

type ProxySessionProvider = {
  newUrl(sessionId: string): Promise<string | undefined>;
};

type RobotsRules = Pick<RobotsTxtFile, 'isAllowed'>;

type RequestStartGateDependencies = {
  now?: () => number;
  wait?: (milliseconds: number) => Promise<unknown>;
};

type PrepareDependencies = {
  loadRobots?: (
    sourceUrl: string,
    proxyUrl: string
  ) => Promise<RobotsRules>;
} & RequestStartGateDependencies;

export type SourceRequestStartGate = {
  waitForTurn(): Promise<number>;
};

export function createSourceRequestStartGate(
  delaySeconds: number,
  dependencies: RequestStartGateDependencies = {}
): SourceRequestStartGate {
  const minimumIntervalMilliseconds = Math.max(
    13_000,
    Math.trunc(delaySeconds * 1000)
  );
  const now = dependencies.now || (() => performance.now());
  const wait =
    dependencies.wait ||
    ((milliseconds: number) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastStartedAt: number | null = null;
  let pendingTurn: Promise<unknown> = Promise.resolve();

  return {
    waitForTurn() {
      const turn = pendingTurn.then(async () => {
        while (lastStartedAt !== null) {
          const remainingMilliseconds =
            lastStartedAt + minimumIntervalMilliseconds - now();
          if (remainingMilliseconds <= 0) break;
          await wait(remainingMilliseconds);
        }
        const startedAt = now();
        lastStartedAt = startedAt;
        return startedAt;
      });
      pendingTurn = turn;
      return turn;
    },
  };
}

export function buildSourceSessionId(jobId: string) {
  const safeJobId = jobId.replace(/[^0-9a-zA-Z._~]/g, '_').slice(0, 44);
  return `hunt_${safeJobId || 'job'}`;
}

export function buildStickySessionPoolOptions(sessionId: string) {
  return {
    maxPoolSize: 1,
    sessionOptions: {
      id: sessionId,
      maxUsageCount: 100,
      maxAgeSecs: 1200,
      maxErrorScore: 1,
    },
  } as const;
}

export async function prepareSourceNetworkPolicy(
  input: {
    jobId: string;
    sourceUrl: string;
    delaySeconds: number;
    proxyConfiguration: ProxySessionProvider;
  },
  dependencies: PrepareDependencies = {}
) {
  const sourceSessionId = buildSourceSessionId(input.jobId);
  const proxyUrl = await input.proxyConfiguration.newUrl(sourceSessionId);
  if (!proxyUrl) {
    throw new Error('Türkiye proxy oturumu oluşturulamadı.');
  }

  const requestStartGate = createSourceRequestStartGate(
    input.delaySeconds,
    dependencies
  );
  const loadRobots =
    dependencies.loadRobots ||
    ((sourceUrl: string, robotsProxyUrl: string) =>
      RobotsTxtFile.find(sourceUrl, robotsProxyUrl, {
        timeoutMillis: 45_000,
      }));
  await requestStartGate.waitForTurn();
  const robotsFile = await loadRobots(input.sourceUrl, proxyUrl);

  return {
    sourceSessionId,
    robotsFile,
    requestStartGate,
  };
}

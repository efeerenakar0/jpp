import { RobotsTxtFile } from '@crawlee/utils';

type ProxySessionProvider = {
  newUrl(sessionId: string): Promise<string | undefined>;
};

type RobotsRules = Pick<RobotsTxtFile, 'isAllowed'>;

type PrepareDependencies = {
  now?: () => number;
  loadRobots?: (
    sourceUrl: string,
    proxyUrl: string
  ) => Promise<RobotsRules>;
};

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

  const robotsRequestStartedAt = (dependencies.now || Date.now)();
  const loadRobots =
    dependencies.loadRobots ||
    ((sourceUrl: string, robotsProxyUrl: string) =>
      RobotsTxtFile.find(sourceUrl, robotsProxyUrl, {
        timeoutMillis: 45_000,
      }));
  const robotsFile = await loadRobots(input.sourceUrl, proxyUrl);

  return {
    sourceSessionId,
    robotsFile,
    firstNavigationAt:
      robotsRequestStartedAt + input.delaySeconds * 1000,
  };
}

import 'server-only';

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';

const CAPABILITY_VERSION = 1;
const CAPABILITY_AUDIENCE = 'business-ai-avci-worker-v1';
const MAX_CAPABILITY_LIFETIME_SECONDS = 30 * 60;
const CLOCK_SKEW_SECONDS = 60;

const payloadSchema = z
  .object({
    version: z.literal(CAPABILITY_VERSION),
    audience: z.literal(CAPABILITY_AUDIENCE),
    jobId: z.string().min(1).max(160),
    leaseId: z.string().uuid(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type HuntWorkerCapability = z.infer<typeof payloadSchema>;

type CapabilityEnvironment = Readonly<Record<string, string | undefined>>;

function signingSecret(environment: CapabilityEnvironment) {
  const secret = environment.AVCI_WORKER_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'Avci worker imzalama anahtari en az 32 karakter olmali.'
    );
  }
  return secret;
}

function signatureFor(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function createHuntWorkerCapability(
  input: {
    jobId: string;
    leaseId: string;
    now?: Date;
    lifetimeSeconds?: number;
  },
  environment: CapabilityEnvironment = process.env
) {
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1000);
  const lifetimeSeconds = Math.min(
    MAX_CAPABILITY_LIFETIME_SECONDS,
    Math.max(60, Math.trunc(input.lifetimeSeconds || 20 * 60))
  );
  const payload = payloadSchema.parse({
    version: CAPABILITY_VERSION,
    audience: CAPABILITY_AUDIENCE,
    jobId: input.jobId,
    leaseId: input.leaseId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + lifetimeSeconds,
  });
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  return `${encodedPayload}.${signatureFor(
    encodedPayload,
    signingSecret(environment)
  )}`;
}

export function verifyHuntWorkerCapability(
  token: string,
  input: { expectedJobId?: string; now?: Date } = {},
  environment: CapabilityEnvironment = process.env
): HuntWorkerCapability {
  if (!token || token.length > 2_048) {
    throw new Error('Worker yetkisi gecersiz.');
  }
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra) {
    throw new Error('Worker yetkisi gecersiz.');
  }
  const expectedSignature = signatureFor(
    encodedPayload,
    signingSecret(environment)
  );
  if (!safeEqual(providedSignature, expectedSignature)) {
    throw new Error('Worker yetkisi gecersiz.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );
  } catch {
    throw new Error('Worker yetkisi gecersiz.');
  }
  const payload = payloadSchema.parse(decoded);
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1000);
  if (
    payload.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS ||
    payload.expiresAt <= nowSeconds - CLOCK_SKEW_SECONDS ||
    payload.expiresAt - payload.issuedAt >
      MAX_CAPABILITY_LIFETIME_SECONDS ||
    (input.expectedJobId && payload.jobId !== input.expectedJobId)
  ) {
    throw new Error('Worker yetkisi gecersiz.');
  }
  return payload;
}

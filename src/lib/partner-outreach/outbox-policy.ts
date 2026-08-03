export type PartnerEmailFailureDisposition = 'RETRY' | 'PERMANENT_FAILURE';

export function classifyPartnerEmailFailure(
  status: number
): PartnerEmailFailureDisposition {
  return status === 408 || status === 409 || status === 429 || status >= 500
    ? 'RETRY'
    : 'PERMANENT_FAILURE';
}

export function nextPartnerEmailRetryAt(now: Date, attempt: number) {
  const boundedAttempt = Math.max(0, Math.min(8, attempt));
  const minutes = 2 ** boundedAttempt;
  return new Date(now.getTime() + minutes * 60_000);
}

export function partnerFollowUpSequence(priorApprovedMessageCount: number) {
  const followUpNumber = Math.max(0, Math.floor(priorApprovedMessageCount));
  return {
    allowed: followUpNumber <= 2,
    followUpNumber,
  };
}

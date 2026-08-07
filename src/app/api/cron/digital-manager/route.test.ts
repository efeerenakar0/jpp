import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processCommitments: vi.fn(),
  generateSummaries: vi.fn(),
  recoverActions: vi.fn(),
  recoverInbound: vi.fn(),
  processAssignmentReminders: vi.fn(),
  processAssignmentTimeouts: vi.fn(),
}));

vi.mock('@/lib/digital-manager/action-recovery', () => ({
  recoverStaleManagerActions: mocks.recoverActions,
}));

vi.mock('@/lib/digital-manager/commitment-monitor', () => ({
  generateActiveCompanyDailySummaries: mocks.generateSummaries,
  processDueOperationalCommitments: mocks.processCommitments,
}));

vi.mock('@/lib/whatsapp-incoming', () => ({
  recoverStaleInboundCustomerMessages: mocks.recoverInbound,
}));

vi.mock('@/lib/viewing-workflow/service', () => ({
  processDueViewingAcknowledgementReminders: mocks.processAssignmentReminders,
  processDueViewingAcknowledgements: mocks.processAssignmentTimeouts,
}));

import { GET } from './route';

function cronRequest(authorization = 'Bearer cron-test') {
  return new Request('https://example.test/api/cron/digital-manager', {
    headers: { authorization },
  });
}

describe('digital manager cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-test');
    mocks.processCommitments.mockResolvedValue([]);
    mocks.generateSummaries.mockResolvedValue([]);
    mocks.recoverActions.mockResolvedValue([]);
    mocks.recoverInbound.mockResolvedValue([]);
    mocks.processAssignmentReminders.mockResolvedValue([
      { promptId: 'prompt-a', status: 'REMINDER_QUEUED' },
    ]);
    mocks.processAssignmentTimeouts.mockResolvedValue([
      { attemptId: 'attempt-b', status: 'TIMED_OUT' },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed before running jobs when the cron secret is wrong', async () => {
    const response = await GET(cronRequest('Bearer wrong'));

    expect(response.status).toBe(401);
    expect(mocks.processAssignmentReminders).not.toHaveBeenCalled();
    expect(mocks.processAssignmentTimeouts).not.toHaveBeenCalled();
  });

  it('runs bounded reminders and due timeouts with the same server clock', async () => {
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      viewingAcknowledgementReminders: 1,
      viewingAcknowledgements: 1,
      viewingAcknowledgementReminderActions: [
        { promptId: 'prompt-a', status: 'REMINDER_QUEUED' },
      ],
      viewingAcknowledgementActions: [
        { attemptId: 'attempt-b', status: 'TIMED_OUT' },
      ],
    });
    expect(mocks.processAssignmentReminders).toHaveBeenCalledWith(expect.any(Date));
    expect(mocks.processAssignmentTimeouts).toHaveBeenCalledWith(expect.any(Date));
    expect(mocks.processAssignmentReminders.mock.calls[0]?.[0]).toBe(
      mocks.processAssignmentTimeouts.mock.calls[0]?.[0]
    );
  });
});

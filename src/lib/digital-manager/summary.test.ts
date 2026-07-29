import { describe, expect, it } from 'vitest';

import { summarizeVerifiedFacts } from './workflow';

describe('verified manager summary', () => {
  it('includes verified employee load and deterministic next actions', () => {
    const result = summarizeVerifiedFacts({
      newCustomers: 2,
      hotCustomers: 1,
      newProperties: 1,
      authorizationInterests: 0,
      confirmedViewings: 1,
      openTasks: 3,
      completedTasks: 2,
      overdueCommitments: 1,
      deliveryFailures: 0,
      pendingApprovals: 1,
      employeeStatuses: [
        {
          name: 'Ayşe',
          availability: 'AVAILABLE',
          openTasks: 2,
          phoneVerified: true,
        },
      ],
      nextActions: [
        'Süresi geçen taahhüdü sonuçlandırın.',
        'Patron onayını kararlaştırın.',
      ],
      evidenceIds: ['contact:1'],
    });

    expect(result.text).toContain('Ayşe müsait, 2 açık görev');
    expect(result.text).toContain('Önerilen sonraki adımlar');
    expect(result.text).toContain('Patron onayını kararlaştırın');
    expect(result.evidenceIds).toEqual(['contact:1']);
  });
});

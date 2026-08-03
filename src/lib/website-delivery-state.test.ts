import { describe, expect, it } from 'vitest';

import {
  assertWebsiteDeliveryTransition,
  canCustomerAccessWebsiteDelivery,
  websiteDeliveryTransitions,
} from './website-delivery-state';

describe('website delivery workflow', () => {
  it('allows only the explicit admin-in-the-loop delivery chain', () => {
    expect(websiteDeliveryTransitions.SUBMITTED).toEqual([
      'IN_PROGRESS',
      'FAILED',
    ]);
    expect(() =>
      assertWebsiteDeliveryTransition('IN_PROGRESS', 'READY_FOR_QA')
    ).not.toThrow();
    expect(() =>
      assertWebsiteDeliveryTransition('READY_FOR_QA', 'DELIVERED')
    ).toThrow(/geçiş/iu);
    expect(() =>
      assertWebsiteDeliveryTransition('CHANGES_REQUESTED', 'IN_PROGRESS')
    ).not.toThrow();
  });

  it('hides every result until QA approval and keeps delivery idempotent', () => {
    expect(canCustomerAccessWebsiteDelivery('READY_FOR_QA')).toBe(false);
    expect(canCustomerAccessWebsiteDelivery('CHANGES_REQUESTED')).toBe(false);
    expect(canCustomerAccessWebsiteDelivery('APPROVED')).toBe(true);
    expect(canCustomerAccessWebsiteDelivery('DELIVERED')).toBe(true);
    expect(() =>
      assertWebsiteDeliveryTransition('DELIVERED', 'DELIVERED')
    ).not.toThrow();
  });
});

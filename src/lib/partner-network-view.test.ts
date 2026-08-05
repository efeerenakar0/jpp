import { describe, expect, it } from 'vitest';
import {
  filterPartnersForQueue,
  getPartnerIdFromSearchParams,
  getPartnerQueue,
  getPartnerQueueMetrics,
} from '@/lib/partner-network-view';

type RecordFixture = {
  id: string;
  stage: string;
  contacts: Array<{ active: boolean; verificationStatus: string }>;
};

const fixtures: RecordFixture[] = [
  { id: 'candidate', stage: 'DISCOVERED', contacts: [] },
  {
    id: 'approval',
    stage: 'QUALIFIED',
    contacts: [{ active: true, verificationStatus: 'UNVERIFIED' }],
  },
  {
    id: 'pipeline',
    stage: 'ENGAGED',
    contacts: [{ active: true, verificationStatus: 'SOURCE_VERIFIED' }],
  },
  {
    id: 'active',
    stage: 'ACTIVE',
    contacts: [{ active: true, verificationStatus: 'UNVERIFIED' }],
  },
  { id: 'closed', stage: 'ARCHIVED', contacts: [] },
];

describe('partner ağı görünüm kuralları', () => {
  it('bir partneri yalnızca tek bir işlem kuyruğuna yerleştirir', () => {
    expect(fixtures.map((partner) => [partner.id, getPartnerQueue(partner)])).toEqual([
      ['candidate', 'candidates'],
      ['approval', 'approval'],
      ['pipeline', 'pipeline'],
      ['active', 'active'],
      ['closed', null],
    ]);

    expect(filterPartnersForQueue(fixtures, 'candidates').map(({ id }) => id)).toEqual([
      'candidate',
    ]);
    expect(filterPartnersForQueue(fixtures, 'approval').map(({ id }) => id)).toEqual([
      'approval',
    ]);
    expect(filterPartnersForQueue(fixtures, 'pipeline').map(({ id }) => id)).toEqual([
      'pipeline',
    ]);
    expect(filterPartnersForQueue(fixtures, 'active').map(({ id }) => id)).toEqual([
      'active',
    ]);
  });

  it('kuyruk sayaçlarını ekrandaki listelerle aynı kuralla hesaplar', () => {
    expect(getPartnerQueueMetrics(fixtures)).toEqual({
      candidates: 1,
      approval: 1,
      pipeline: 1,
      active: 1,
    });
  });

  it('yalnız tekil ve güvenli partner sorgu değerini kabul eder', () => {
    expect(getPartnerIdFromSearchParams({ partner: ' partner_123 ' })).toBe('partner_123');
    expect(getPartnerIdFromSearchParams({ partner: ['one', 'two'] })).toBeNull();
    expect(getPartnerIdFromSearchParams({ partner: '../secret' })).toBeNull();
    expect(getPartnerIdFromSearchParams({})).toBeNull();
  });
});

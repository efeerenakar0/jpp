import { describe, expect, it } from 'vitest';
import {
  filterPartnerDirectory,
  filterPartnersForQueue,
  getPartnerIdFromSearchParams,
  getPartnerMessageStatusLabel,
  getPartnerQueue,
  getPartnerQueueMetrics,
  getPartnerStageLabel,
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

  it('ülke, şehir, dil ve uzmanlık filtrelerini birlikte uygular', () => {
    const directory = [
      {
        ...fixtures[0],
        displayName: 'Berlin Homes',
        countryCode: 'DE',
        countryName: 'Almanya',
        city: 'Berlin',
        languages: ['Almanca', 'İngilizce'],
        specialties: ['Konut', 'Yatırım'],
      },
      {
        ...fixtures[2],
        displayName: 'Dubai Estates',
        countryCode: 'AE',
        countryName: 'Birleşik Arap Emirlikleri',
        city: 'Dubai',
        languages: ['İngilizce', 'Arapça'],
        specialties: ['Lüks konut'],
      },
    ];

    expect(
      filterPartnerDirectory(directory, {
        search: 'homes',
        countryCode: 'DE',
        city: 'Berlin',
        language: 'Almanca',
        specialty: 'Yatırım',
      }).map(({ displayName }) => displayName),
    ).toEqual(['Berlin Homes']);

    expect(
      filterPartnerDirectory(directory, {
        search: '',
        countryCode: '',
        city: 'Dubai',
        language: 'Almanca',
        specialty: '',
      }),
    ).toEqual([]);
  });

  it('teslimatı cevapla karıştırmaz ve inbox yokken yanıtı manuel olarak etiketler', () => {
    expect(getPartnerMessageStatusLabel('SENT')).toBe(
      'Gönderildi · yanıt durumu bilinmiyor'
    );
    expect(getPartnerMessageStatusLabel('DELIVERED')).toBe(
      'Teslim edildi · yanıt durumu bilinmiyor'
    );
    expect(getPartnerStageLabel('ENGAGED', { inboxSynchronized: false })).toBe(
      'Yanıt kaydedildi (manuel)'
    );
    expect(getPartnerStageLabel('ENGAGED', { inboxSynchronized: true })).toBe(
      'Yanıt alındı'
    );
  });
});

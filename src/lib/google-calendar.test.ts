import { CrmTaskType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { classifyGoogleEvent } from './google-calendar';

describe('classifyGoogleEvent', () => {
  it('Jasmine özel türünü korur', () => {
    expect(
      classifyGoogleEvent({
        summary: 'Müşteri buluşması',
        extendedProperties: {
          private: { jasmineTaskType: CrmTaskType.VIEWING },
        },
      })
    ).toBe(CrmTaskType.VIEWING);
  });

  it('Google başlığından gösterim ve randevuyu ayırır', () => {
    expect(
      classifyGoogleEvent({
        summary: 'Kestel portföy gösterimi',
      })
    ).toBe(CrmTaskType.VIEWING);
    expect(
      classifyGoogleEvent({
        summary: 'Yeni müşteri randevusu',
      })
    ).toBe(CrmTaskType.MEETING);
  });

  it('bilinmeyen Google etkinliğini diğer olarak işaretler', () => {
    expect(classifyGoogleEvent({ summary: 'Ofis planı' })).toBe(
      CrmTaskType.OTHER
    );
  });
});

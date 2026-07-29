import { writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { getDocumentTemplate } from './catalog';
import { createDocumentSnapshot } from './engine';

vi.mock('server-only', () => ({}));

import { renderDocumentDocx } from './docx';
import { renderDocumentPdf } from './pdf';

const template = getDocumentTemplate('kapora-teslim-belgesi');
const snapshot = createDocumentSnapshot(template, {
  documentNumber: 'JAS-290726-TEST',
  issuePlace: 'İstanbul',
  issueDate: '2026-07-29',
  companyName: 'Jasmine Group',
  advisorName: 'Efe Eren',
  depositGiverName: 'Ayşe Yılmaz',
  depositReceiverName: 'Mehmet Demir',
  depositReceiverTitle: 'Satıcı',
  buyerName: 'Ayşe Yılmaz',
  buyerPhone: '+90 555 111 22 33',
  sellerName: 'Mehmet Demir',
  sellerPhone: '+90 555 444 55 66',
  propertyType: 'KONUT',
  propertyAddress: 'Moda Caddesi No: 10 D: 4',
  province: 'İstanbul',
  district: 'Kadıköy',
  neighborhood: 'Caferağa',
  portfolioNumber: 'PF-100',
  salePrice: 8_500_000,
  depositAmount: 250_000,
  paymentMethod: 'BANK_TRANSFER',
  paymentDate: '2026-07-29',
  remainingPaymentDate: '2026-08-15',
  deedTransferDate: '2026-08-15',
  expenseResponsibility: 'SHARED',
  refundCondition: 'Finansman onayının alınamaması halinde iade edilir.',
  withdrawalCondition:
    'Alıcının haklı neden olmaksızın cayması halinde kapora mahsup edilir.',
  furnished: false,
  guarantorExists: false,
  corporateParty: false,
});

describe('Belge Merkezi çıktı üretimi', () => {
  it('Türkçe karakterli, geçerli PDF tamponu üretir', async () => {
    const buffer = await renderDocumentPdf({
      snapshot,
      companyName: 'Jasmine Group',
      logo: null,
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(10_000);

    if (process.env.DOCUMENT_PDF_SAMPLE_PATH) {
      await writeFile(process.env.DOCUMENT_PDF_SAMPLE_PATH, buffer);
    }
  }, 20_000);

  it('Word tarafından açılabilen DOCX tamponu üretir', async () => {
    const buffer = await renderDocumentDocx({
      snapshot,
      companyName: 'Jasmine Group',
    });
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(buffer.length).toBeGreaterThan(8_000);
  });
});

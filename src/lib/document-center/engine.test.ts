import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TEMPLATE_NAMES,
  documentTemplates,
  getDocumentTemplate,
} from './catalog';
import {
  createDocumentSnapshot,
  formatTurkishDate,
  formatTurkishMoney,
  renderDocument,
  validateDocumentValues,
} from './engine';

describe('Belge Merkezi katalog ve belge motoru', () => {
  it('başlangıç kataloğundaki 50 belgenin tamamını eksiksiz sunar', () => {
    expect(documentTemplates).toHaveLength(50);
    expect(documentTemplates.map((template) => template.name)).toEqual(
      DOCUMENT_TEMPLATE_NAMES
    );

    for (const template of documentTemplates) {
      expect(template.fields.length).toBeGreaterThanOrEqual(8);
      expect(template.sections.length).toBeGreaterThanOrEqual(5);
      expect(template.description.length).toBeGreaterThan(25);
      expect(template.sources.length).toBeGreaterThan(0);
      expect(template.legalNotice).toContain('hukuk uzmanı');
    }
  });

  it('her belge için belgeye özgü soru alanı açar', () => {
    const fieldSignatures = documentTemplates.map((template) =>
      template.fields.map((field) => field.key).sort().join('|')
    );
    expect(new Set(fieldSignatures).size).toBe(documentTemplates.length);
  });

  it('Kapora Teslim Belgesi için verilen bilgilerden tamamlanmış cümle üretir', () => {
    const template = getDocumentTemplate('kapora-teslim-belgesi');
    const rendered = renderDocument(template, {
      documentNumber: 'JAS-TEST-9F4C',
      issuePlace: 'İstanbul',
      issueDate: '2026-07-29',
      companyName: 'Jasmine Group',
      advisorName: 'Efe Eren',
      depositGiverName: 'Ayşe Yılmaz',
      depositReceiverName: 'Mehmet Demir',
      depositReceiverTitle: 'Satıcı',
      buyerName: 'Ayşe Yılmaz',
      sellerName: 'Mehmet Demir',
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
      refundCondition: 'Finansman onayının alınamaması halinde iade edilir.',
      withdrawalCondition:
        'Alıcının haklı neden olmaksızın cayması halinde kapora mahsup edilir.',
      specialTerms: '',
    });

    expect(rendered.plainText).toContain(
      'İstanbul ili, Kadıköy ilçesi, Caferağa Mahallesi'
    );
    expect(rendered.plainText).toContain('toplam 8.500.000,00 TL');
    expect(rendered.plainText).toContain('250.000,00 TL kapora');
    expect(rendered.plainText).toContain('banka havalesi');
    expect(rendered.unresolvedTokens).toEqual([]);
  });

  it('koşullu maddeleri yalnızca ilgili seçim yapıldığında ekler', () => {
    const template = getDocumentTemplate('konut-kira-sozlesmesi');
    const baseValues = {
      documentNumber: 'JAS-TEST-RENT',
      issuePlace: 'Alanya',
      issueDate: '2026-07-29',
      companyName: 'Jasmine Group',
      advisorName: 'Efe Eren',
      landlordName: 'Kiraya Veren',
      tenantName: 'Kiracı',
      propertyAddress: 'Kestel Mahallesi No: 1',
      province: 'Antalya',
      district: 'Alanya',
      neighborhood: 'Kestel',
      monthlyRent: 40_000,
      depositAmount: 80_000,
      leaseStartDate: '2026-08-01',
      leaseDurationMonths: 12,
      paymentDay: 5,
      paymentMethod: 'BANK_TRANSFER',
      furnished: false,
      guarantorExists: false,
      expenseResponsibility: 'TENANT',
    };

    const plain = renderDocument(template, baseValues).plainText;
    expect(plain).not.toContain('DEMİRBAŞ VE EŞYALAR');
    expect(plain).not.toContain('KEFİL');

    const conditional = renderDocument(template, {
      ...baseValues,
      furnished: true,
      inventoryDetails: 'Buzdolabı, çamaşır makinesi ve klima',
      guarantorExists: true,
      guarantorName: 'Ali Kefil',
      guarantorIdentityNumber: '11111111110',
    }).plainText;
    expect(conditional).toContain('DEMİRBAŞ VE EŞYALAR');
    expect(conditional).toContain('Buzdolabı, çamaşır makinesi ve klima');
    expect(conditional).toContain('KEFİL');
    expect(conditional).toContain('Ali Kefil');
  });

  it('eksik zorunlu alanları bildirir ve tamamlanmamış belgeyi geçersiz sayar', () => {
    const template = getDocumentTemplate('satis-yetkilendirme-sozlesmesi');
    const result = validateDocumentValues(template, {
      companyName: 'Jasmine Group',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.key === 'ownerName')).toBe(true);
    expect(result.errors.some((error) => error.key === 'propertyAddress')).toBe(
      true
    );
  });

  it('Türkçe para ve tarih biçimlendirmesini doğru uygular', () => {
    expect(formatTurkishMoney(8_500_000)).toBe('8.500.000,00 TL');
    expect(formatTurkishDate('2026-07-29')).toBe('29 Temmuz 2026');
  });

  it('nihai metinde çözülmemiş değişken, undefined veya null bırakmaz', () => {
    const template = getDocumentTemplate('portfoy-bilgi-formu');
    const rendered = renderDocument(template, {
      documentNumber: 'JAS-TEST-PORT',
      issuePlace: 'Alanya',
      issueDate: '2026-07-29',
      companyName: 'Jasmine Group',
      advisorName: 'Efe Eren',
      ownerName: 'Mülk Sahibi',
      propertyType: 'VILLA',
      propertyAddress: 'Bektaş Mahallesi',
      province: 'Antalya',
      district: 'Alanya',
      neighborhood: 'Bektaş',
      portfolioNumber: 'PF-22',
      askingPrice: 12_000_000,
      roomCount: '4+1',
      area: 240,
      occupancyStatus: 'BOŞ',
    });

    expect(rendered.unresolvedTokens).toEqual([]);
    expect(rendered.plainText).not.toMatch(/\{\{[^}]+\}\}|\bundefined\b|\bnull\b/i);
  });

  it('oluşturulan anlık görüntüyü sonraki değer değişikliklerinden korur', () => {
    const template = getDocumentTemplate('alici-talep-formu');
    const values = {
      documentNumber: 'JAS-SNAPSHOT',
      issuePlace: 'Alanya',
      issueDate: '2026-07-29',
      companyName: 'Jasmine Group',
      advisorName: 'Efe Eren',
      customerName: 'Deniz Kaya',
      customerPhone: '+90 555 000 00 00',
      desiredProvince: 'Antalya',
      desiredDistrict: 'Alanya',
      desiredPropertyType: 'KONUT',
      desiredRoomCount: '2+1',
      budgetMin: 4_000_000,
      budgetMax: 6_000_000,
      purchasePurpose: 'İkamet',
    };

    const snapshot = createDocumentSnapshot(template, values);
    values.customerName = 'Değiştirilen İsim';

    expect(snapshot.values.customerName).toBe('Deniz Kaya');
    expect(snapshot.rendered.plainText).toContain('Deniz Kaya');
    expect(snapshot.templateVersion).toBe(template.version);
  });
});

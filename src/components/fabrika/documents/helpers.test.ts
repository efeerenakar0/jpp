import { describe, expect, it } from 'vitest';
import { getDocumentTemplate } from '../../../lib/document-center/catalog';
import type { DocumentContextDTO } from '../../../lib/document-center/types';
import {
  createInitialValues,
  findQuickStartTemplate,
  fillFromContact,
  fillFromProperty,
} from './helpers';

const context: DocumentContextDTO = {
  company: {
    id: 'company-a',
    name: 'Akar Group',
    ownerName: 'Akar Patron',
    ownerEmail: 'patron@example.com',
    ownerPhone: '+90 555 100 00 00',
    logo: null,
  },
  principal: {
    type: 'EMPLOYEE',
    id: 'member-a',
    name: 'Danışman Deniz',
    email: 'deniz@example.com',
    phone: '+90 555 200 00 00',
  },
  contacts: [
    {
      id: 'contact-a',
      name: 'Ayşe Müşteri',
      phone: '+90 555 300 00 00',
      email: 'ayse@example.com',
      type: 'BUYER',
    },
  ],
  properties: [
    {
      id: 'property-a',
      title: 'Kestel 2+1',
      referenceCode: 'PF-42',
      location: 'Antalya, Alanya, Kestel Mahallesi',
      price: 6_500_000,
      roomCount: '2+1',
      area: 115,
      ownerContactId: 'owner-a',
      ownerName: 'Mehmet Malik',
    },
  ],
};

describe('Belge Merkezi otomatik doldurma', () => {
  it('şirket, danışman ve tarihi taslağa yerleştirir', () => {
    const template = getDocumentTemplate('satis-yetkilendirme-sozlesmesi');
    const values = createInitialValues(template, context);
    expect(values.companyName).toBe('Akar Group');
    expect(values.advisorName).toBe('Danışman Deniz');
    expect(values.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('portföy seçimini belge alanlarına dağıtır', () => {
    const values = fillFromProperty({}, 'property-a', context);
    expect(values.propertyAddress).toBe(
      'Antalya, Alanya, Kestel Mahallesi'
    );
    expect(values.portfolioNumber).toBe('PF-42');
    expect(values.salePrice).toBe(6_500_000);
    expect(values.ownerName).toBe('Mehmet Malik');
  });

  it('CRM kişisini şablondaki uygun taraf alanlarına yerleştirir', () => {
    const template = getDocumentTemplate('alici-talep-formu');
    const values = fillFromContact({}, 'contact-a', template, context);
    expect(values.customerName).toBe('Ayşe Müşteri');
    expect(values.customerPhone).toBe('+90 555 300 00 00');
  });
});

describe('Belge ve Sözleşme Asistanı hızlı başlangıç', () => {
  const templates = [
    getDocumentTemplate('satis-yetkilendirme-sozlesmesi'),
    getDocumentTemplate('kiralama-yetkilendirme-sozlesmesi'),
    getDocumentTemplate('acik-riza-metni'),
  ].map((template) => ({ ...template, favorite: false }));

  it('doğal dil isteğini en uygun sözleşme şablonuna bağlar', () => {
    expect(
      findQuickStartTemplate(
        templates,
        'Kiralama yetkilendirme sözleşmesi hazırla'
      )?.key
    ).toBe('kiralama-yetkilendirme-sozlesmesi');
  });

  it('Türkçe büyük-küçük harf farkından etkilenmez', () => {
    expect(findQuickStartTemplate(templates, 'AÇIK RIZA METNİ')?.key).toBe(
      'acik-riza-metni'
    );
  });

  it('boş istek için şablon seçmez', () => {
    expect(findQuickStartTemplate(templates, '   ')).toBeNull();
  });
});

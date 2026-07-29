import type {
  DocumentContextDTO,
  DocumentFieldDefinition,
  DocumentTemplateDefinition,
  DocumentValue,
  DocumentValues,
} from '@/lib/document-center/types';

export function createInitialValues(
  template: DocumentTemplateDefinition,
  context: DocumentContextDTO
) {
  const values: DocumentValues = {};
  for (const field of template.fields) {
    if (field.defaultValue !== undefined) values[field.key] = field.defaultValue;
    if (field.autofill === 'company.name') values[field.key] = context.company.name;
    if (field.autofill === 'principal.name') {
      values[field.key] = context.principal.name;
    }
    if (field.autofill === 'today') {
      values[field.key] = new Date().toISOString().slice(0, 10);
    }
  }
  return values;
}

export function fillFromProperty(
  values: DocumentValues,
  propertyId: string,
  context: DocumentContextDTO
): DocumentValues {
  const property = context.properties.find((item) => item.id === propertyId);
  if (!property) return { ...values, propertyId };
  return {
    ...values,
    propertyId,
    propertyAddress: property.location || values.propertyAddress,
    portfolioNumber: property.referenceCode || values.portfolioNumber,
    askingPrice: property.price ?? values.askingPrice,
    salePrice: property.price ?? values.salePrice,
    roomCount: property.roomCount || values.roomCount,
    area: property.area ?? values.area,
    ownerName: property.ownerName || values.ownerName,
  };
}

export function fillFromContact(
  values: DocumentValues,
  contactId: string,
  template: DocumentTemplateDefinition,
  context: DocumentContextDTO
): DocumentValues {
  const contact = context.contacts.find((item) => item.id === contactId);
  if (!contact) return values;

  const next: DocumentValues = { ...values, selectedContactId: contactId };
  const candidates = [
    ['customerName', 'customerPhone', 'customerEmail'],
    ['buyerName', 'buyerPhone', 'buyerEmail'],
    ['tenantName', 'tenantPhone', 'tenantEmail'],
    ['ownerName', 'ownerPhone', 'ownerEmail'],
    ['sellerName', 'sellerPhone', 'sellerEmail'],
    ['landlordName', 'landlordPhone', 'landlordEmail'],
  ];
  const keys = new Set(template.fields.map((field) => field.key));
  const target = candidates.find(([name]) => keys.has(name));
  if (!target) return next;

  next[target[0]] = contact.name;
  if (keys.has(target[1])) next[target[1]] = contact.phone;
  if (keys.has(target[2])) next[target[2]] = contact.email;
  return next;
}

export function fieldIsVisible(
  field: DocumentFieldDefinition,
  values: DocumentValues
) {
  if (!field.visibleWhen) return true;
  const current = values[field.visibleWhen.field];
  if (field.visibleWhen.truthy !== undefined) {
    return field.visibleWhen.truthy ? Boolean(current) : !current;
  }
  if (field.visibleWhen.equals !== undefined) {
    return current === field.visibleWhen.equals;
  }
  if (field.visibleWhen.notEquals !== undefined) {
    return current !== field.visibleWhen.notEquals;
  }
  if (field.visibleWhen.in) {
    return field.visibleWhen.in.includes(current ?? null);
  }
  return true;
}

export function toInputValue(value: DocumentValue | undefined) {
  if (value === null || value === undefined) return '';
  return Array.isArray(value) ? value.join(', ') : String(value);
}

export function documentStatusLabel(status: DocumentRecordDTOStatus) {
  return {
    DRAFT: 'Taslak',
    GENERATED: 'Tamamlandı',
    ARCHIVED: 'Arşivde',
    CANCELLED: 'İptal',
  }[status];
}

type DocumentRecordDTOStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'ARCHIVED'
  | 'CANCELLED';

export function legalStatusLabel(
  status: 'DRAFT' | 'COMPANY_APPROVED' | 'LEGAL_REVIEWED' | 'NEEDS_UPDATE'
) {
  return {
    DRAFT: 'Hukuk incelemesi bekliyor',
    COMPANY_APPROVED: 'Şirket onaylı',
    LEGAL_REVIEWED: 'Hukuk incelemesi yapılmış',
    NEEDS_UPDATE: 'Güncelleme gerekli',
  }[status];
}

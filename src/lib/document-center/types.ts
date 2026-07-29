export const DOCUMENT_LEGAL_NOTICE =
  'Bu belge şablon olarak hazırlanmıştır. Kullanılmadan önce güncel mevzuata ve somut işleme uygunluğu hukuk uzmanı tarafından kontrol edilmelidir.';

export const DOCUMENT_CATEGORIES = [
  'AUTHORIZATION_MARKETING',
  'SHOWING_CUSTOMER_SERVICE',
  'SALES',
  'RENTAL',
  'PORTFOLIO_PROPERTY',
  'CUSTOMER_PRIVACY',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  AUTHORIZATION_MARKETING: 'Yetkilendirme ve pazarlama',
  SHOWING_CUSTOMER_SERVICE: 'Gösterim ve müşteri hizmetleri',
  SALES: 'Satış işlemleri',
  RENTAL: 'Kiralama işlemleri',
  PORTFOLIO_PROPERTY: 'Portföy ve taşınmaz bilgileri',
  CUSTOMER_PRIVACY: 'Müşteri ve kişisel veri belgeleri',
};

export type DocumentLegalStatus =
  | 'DRAFT'
  | 'COMPANY_APPROVED'
  | 'LEGAL_REVIEWED'
  | 'NEEDS_UPDATE';

export type DocumentFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'money'
  | 'percent'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'person'
  | 'company'
  | 'portfolio'
  | 'address'
  | 'deed'
  | 'contact'
  | 'signature'
  | 'file';

export type DocumentValue = string | number | boolean | string[] | null;
export type DocumentValues = Record<string, DocumentValue | undefined>;

export interface DocumentCondition {
  field: string;
  equals?: DocumentValue;
  notEquals?: DocumentValue;
  in?: DocumentValue[];
  truthy?: boolean;
}

export interface DocumentFieldOption {
  value: string;
  label: string;
}

export interface DocumentCalculation {
  kind: 'difference' | 'sum' | 'percentage';
  operands: string[];
}

export interface DocumentFieldDefinition {
  key: string;
  label: string;
  type: DocumentFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: DocumentFieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  defaultValue?: DocumentValue;
  autofill?: string;
  visibleWhen?: DocumentCondition;
  calculated?: DocumentCalculation;
  readOnly?: boolean;
}

export interface DocumentParagraphTemplate {
  text: string;
  condition?: DocumentCondition;
}

export interface DocumentSectionTemplate {
  id: string;
  heading: string;
  paragraphs: DocumentParagraphTemplate[];
  condition?: DocumentCondition;
  keepTogether?: boolean;
}

export interface DocumentSource {
  title: string;
  url: string;
  note: string;
}

export interface DocumentTemplateDefinition {
  key: string;
  name: string;
  category: DocumentCategory;
  description: string;
  estimatedMinutes: number;
  version: number;
  active: boolean;
  updatedAt: string;
  lastReviewedAt: string;
  legalStatus: DocumentLegalStatus;
  legalNotice: string;
  officialFormWarning?: string;
  sources: DocumentSource[];
  fields: DocumentFieldDefinition[];
  sections: DocumentSectionTemplate[];
  signatureRoles: string[];
  tags: string[];
}

export interface RenderedDocumentSection {
  id: string;
  heading: string;
  paragraphs: string[];
  keepTogether?: boolean;
}

export interface RenderedSignature {
  label: string;
  name: string;
}

export interface RenderedDocument {
  title: string;
  documentNumber: string;
  issueLine: string;
  sections: RenderedDocumentSection[];
  signatures: RenderedSignature[];
  legalNotice: string;
  officialFormWarning?: string;
  plainText: string;
  unresolvedTokens: string[];
}

export interface DocumentValidationError {
  key: string;
  message: string;
}

export interface DocumentValidationResult {
  valid: boolean;
  errors: DocumentValidationError[];
}

export interface DocumentSnapshot {
  templateKey: string;
  templateVersion: number;
  values: DocumentValues;
  rendered: RenderedDocument;
  createdAt: string;
}

export interface DocumentContextDTO {
  company: {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string | null;
    ownerPhone: string | null;
    logo: string | null;
  };
  principal: {
    type: 'OWNER' | 'EMPLOYEE';
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  contacts: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    type: string;
  }>;
  properties: Array<{
    id: string;
    title: string;
    referenceCode: string | null;
    location: string | null;
    price: number | null;
    roomCount: string | null;
    area: number | null;
    ownerContactId: string | null;
    ownerName: string | null;
  }>;
}

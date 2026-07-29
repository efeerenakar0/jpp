import type {
  DocumentCondition,
  DocumentFieldDefinition,
  DocumentSnapshot,
  DocumentTemplateDefinition,
  DocumentValidationResult,
  DocumentValue,
  DocumentValues,
  RenderedDocument,
} from './types';

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)(?::([a-zA-Z]+))?\s*\}\}/g;
const UNRESOLVED_PATTERN = /\{\{[^}]+\}\}|\[[A-ZÇĞİÖŞÜ0-9 _-]{2,}\]/g;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  KONUT: 'konut',
  IS_YERI: 'iş yeri',
  ARSA: 'arsa',
  VILLA: 'villa',
  DAIRE: 'daire',
  DIGER: 'diğer taşınmaz',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'banka havalesi',
  CASH: 'nakit',
  CREDIT_CARD: 'kredi kartı',
  OTHER: 'diğer ödeme yöntemi',
};

const RESPONSIBILITY_LABELS: Record<string, string> = {
  BUYER: 'alıcı',
  SELLER: 'satıcı',
  TENANT: 'kiracı',
  LANDLORD: 'kiraya veren',
  SHARED: 'taraflar eşit olarak',
  COMPANY: 'hizmet veren şirket',
};

const ONES = [
  '',
  'bir',
  'iki',
  'üç',
  'dört',
  'beş',
  'altı',
  'yedi',
  'sekiz',
  'dokuz',
];
const TENS = [
  '',
  'on',
  'yirmi',
  'otuz',
  'kırk',
  'elli',
  'altmış',
  'yetmiş',
  'seksen',
  'doksan',
];

function threeDigitsToWords(value: number) {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  return [
    hundreds > 0 ? `${hundreds === 1 ? '' : ONES[hundreds]} yüz`.trim() : '',
    TENS[tens],
    ONES[ones],
  ]
    .filter(Boolean)
    .join(' ');
}

export function numberToTurkishWords(input: number) {
  const value = Math.max(0, Math.trunc(input));
  if (value === 0) return 'sıfır';

  const groups = [
    { divisor: 1_000_000_000, label: 'milyar' },
    { divisor: 1_000_000, label: 'milyon' },
    { divisor: 1_000, label: 'bin' },
    { divisor: 1, label: '' },
  ];
  let remainder = value;
  const words: string[] = [];

  for (const group of groups) {
    const amount = Math.floor(remainder / group.divisor);
    if (amount <= 0) continue;
    remainder %= group.divisor;
    if (group.divisor === 1_000 && amount === 1) {
      words.push('bin');
      continue;
    }
    words.push(
      [threeDigitsToWords(amount), group.label].filter(Boolean).join(' ')
    );
  }

  return words.join(' ').replace(/\s+/g, ' ').trim();
}

export function formatTurkishMoney(value: DocumentValue | undefined) {
  const amount =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount)) return 'belirtilmemiş';
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} TL`;
}

export function formatTurkishMoneyWithWords(
  value: DocumentValue | undefined
) {
  const amount =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount)) return 'belirtilmemiş';
  return `${formatTurkishMoney(amount)} (${numberToTurkishWords(
    amount
  )} Türk lirası)`;
}

export function formatTurkishDate(value: DocumentValue | undefined) {
  if (!value) return 'belirtilmemiş';
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00.000Z`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return 'belirtilmemiş';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function formatTurkishDateTime(value: DocumentValue | undefined) {
  if (!value) return 'belirtilmemiş';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'belirtilmemiş';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function isEmpty(value: DocumentValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function matchesCondition(
  condition: DocumentCondition | undefined,
  values: DocumentValues
) {
  if (!condition) return true;
  const value = values[condition.field];
  if (condition.truthy !== undefined) {
    return condition.truthy ? Boolean(value) : !value;
  }
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.notEquals !== undefined) return value !== condition.notEquals;
  if (condition.in) return condition.in.includes(value ?? null);
  return true;
}

function calculateField(
  field: DocumentFieldDefinition,
  values: DocumentValues
): DocumentValue | undefined {
  if (!field.calculated) return values[field.key];
  const operands = field.calculated.operands.map((key) => {
    const value = Number(values[key]);
    return Number.isFinite(value) ? value : 0;
  });
  if (field.calculated.kind === 'difference') {
    return operands.slice(1).reduce((result, value) => result - value, operands[0] || 0);
  }
  if (field.calculated.kind === 'sum') {
    return operands.reduce((result, value) => result + value, 0);
  }
  const [base = 0, rate = 0] = operands;
  return base * (rate / 100);
}

export function resolveCalculatedValues(
  template: DocumentTemplateDefinition,
  values: DocumentValues
) {
  const result: DocumentValues = { ...values };
  for (const field of template.fields) {
    if (field.calculated) result[field.key] = calculateField(field, result);
  }
  return result;
}

function findField(
  template: DocumentTemplateDefinition,
  key: string
) {
  return template.fields.find((field) => field.key === key);
}

function optionLabel(
  template: DocumentTemplateDefinition,
  key: string,
  value: DocumentValue | undefined
) {
  const field = findField(template, key);
  if (!field?.options || isEmpty(value)) return null;
  if (Array.isArray(value)) {
    return value
      .map(
        (entry) =>
          field.options?.find((option) => option.value === entry)?.label || entry
      )
      .join(', ');
  }
  return (
    field.options.find((option) => option.value === String(value))?.label || null
  );
}

function formatValue(
  template: DocumentTemplateDefinition,
  key: string,
  format: string | undefined,
  value: DocumentValue | undefined
) {
  if (format === 'money') return formatTurkishMoney(value);
  if (format === 'moneywords') return formatTurkishMoneyWithWords(value);
  if (format === 'date') return formatTurkishDate(value);
  if (format === 'datetime') return formatTurkishDateTime(value);
  if (format === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat('tr-TR').format(numeric)
      : 'belirtilmemiş';
  }
  if (format === 'percent') return isEmpty(value) ? 'belirtilmemiş' : `%${value}`;
  if (format === 'property') {
    return PROPERTY_TYPE_LABELS[String(value)] || String(value || 'taşınmaz');
  }
  if (format === 'payment') {
    return PAYMENT_METHOD_LABELS[String(value)] || String(value || 'belirtilmemiş');
  }
  if (format === 'responsibility') {
    return (
      RESPONSIBILITY_LABELS[String(value)] || String(value || 'belirtilmemiş')
    );
  }
  const option = optionLabel(template, key, value);
  if (option) return option;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (isEmpty(value)) return 'belirtilmemiş';
  return String(value).trim();
}

function interpolate(
  template: DocumentTemplateDefinition,
  text: string,
  values: DocumentValues
) {
  return text
    .replace(TOKEN_PATTERN, (_token, key: string, format?: string) =>
      formatValue(template, key, format, values[key])
    )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function signatureFromRole(role: string, values: DocumentValues) {
  const [label, key] = role.split('::');
  return {
    label,
    name: key ? String(values[key] || '') : '',
  };
}

export function validateDocumentValues(
  template: DocumentTemplateDefinition,
  inputValues: DocumentValues
): DocumentValidationResult {
  const values = resolveCalculatedValues(template, inputValues);
  const errors: DocumentValidationResult['errors'] = [];

  for (const field of template.fields) {
    if (!matchesCondition(field.visibleWhen, values)) continue;
    const value = values[field.key];
    if (field.required && isEmpty(value)) {
      errors.push({ key: field.key, message: `${field.label} zorunludur.` });
      continue;
    }
    if (isEmpty(value)) continue;
    const text = Array.isArray(value) ? value.join(',') : String(value);
    if (field.minLength && text.length < field.minLength) {
      errors.push({
        key: field.key,
        message: `${field.label} en az ${field.minLength} karakter olmalıdır.`,
      });
    }
    if (field.maxLength && text.length > field.maxLength) {
      errors.push({
        key: field.key,
        message: `${field.label} en fazla ${field.maxLength} karakter olabilir.`,
      });
    }
    if (field.pattern && !new RegExp(field.pattern).test(text)) {
      errors.push({ key: field.key, message: `${field.label} biçimi geçersizdir.` });
    }
    if (['number', 'money', 'percent'].includes(field.type)) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        errors.push({ key: field.key, message: `${field.label} sayı olmalıdır.` });
      } else {
        if (field.min !== undefined && numeric < field.min) {
          errors.push({
            key: field.key,
            message: `${field.label} en az ${field.min} olmalıdır.`,
          });
        }
        if (field.max !== undefined && numeric > field.max) {
          errors.push({
            key: field.key,
            message: `${field.label} en fazla ${field.max} olabilir.`,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function renderDocument(
  template: DocumentTemplateDefinition,
  inputValues: DocumentValues
): RenderedDocument {
  const values = resolveCalculatedValues(template, inputValues);
  const sections = template.sections
    .filter((section) => matchesCondition(section.condition, values))
    .map((section) => ({
      id: section.id,
      heading: interpolate(template, section.heading, values),
      paragraphs: section.paragraphs
        .filter((paragraph) => matchesCondition(paragraph.condition, values))
        .map((paragraph) => interpolate(template, paragraph.text, values))
        .filter(Boolean),
      keepTogether: section.keepTogether,
    }))
    .filter((section) => section.paragraphs.length > 0)
    .map((section, index) => ({
      ...section,
      heading: section.heading.replace(/^\d+\./, `${index + 1}.`),
    }));

  const signatures = template.signatureRoles
    .filter((role) => {
      if (!role.startsWith('KEFİL::')) return true;
      return Boolean(values.guarantorExists);
    })
    .map((role) => signatureFromRole(role, values));
  const title = template.name.toLocaleUpperCase('tr-TR');
  const documentNumber = String(values.documentNumber || 'Belge numarası oluşturulmadı');
  const issueLine = `${formatTurkishDate(values.issueDate)} - ${
    values.issuePlace || 'Düzenlenme yeri belirtilmemiş'
  }`;
  const plainText = [
    title,
    `Belge No: ${documentNumber}`,
    `Düzenlenme: ${issueLine}`,
    ...sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
    ]),
    'İMZALAR',
    ...signatures.flatMap((signature) => [
      signature.label,
      signature.name || 'İmza sahibinin adı belge üzerinde doldurulacaktır.',
    ]),
    template.legalNotice,
    template.officialFormWarning || '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const unresolvedTokens = plainText.match(UNRESOLVED_PATTERN) || [];

  return {
    title,
    documentNumber,
    issueLine,
    sections,
    signatures,
    legalNotice: template.legalNotice,
    officialFormWarning: template.officialFormWarning,
    plainText,
    unresolvedTokens,
  };
}

export function createDocumentSnapshot(
  template: DocumentTemplateDefinition,
  values: DocumentValues
): DocumentSnapshot {
  const clonedValues =
    typeof structuredClone === 'function'
      ? structuredClone(values)
      : JSON.parse(JSON.stringify(values));
  return {
    templateKey: template.key,
    templateVersion: template.version,
    values: clonedValues,
    rendered: renderDocument(template, clonedValues),
    createdAt: new Date().toISOString(),
  };
}

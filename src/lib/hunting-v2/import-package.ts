import AdmZip from 'adm-zip';
import { z } from 'zod';

export const HUNTING_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const HUNTING_IMPORT_MAX_LISTINGS = 250;

const HUNTING_IMPORT_MAX_ZIP_ENTRIES = 50;
const HUNTING_IMPORT_MAX_JSON_BYTES = 5 * 1024 * 1024;

const sensitivePhoneFields = [
  'ownerPhone',
  'ownerPhoneNormalized',
  'phone',
  'phoneNumber',
  'sellerPhone',
] as const;

export const huntingImportListingSchema = z
  .object({
    listingId: z.string().trim().max(64).optional().nullable(),
    title: z.string().trim().min(2).max(300),
    url: z.string().trim().url().max(3000).optional().nullable(),
    sourceUrl: z.string().trim().url().max(3000).optional().nullable(),
    price: z.string().trim().max(100).optional().nullable(),
    location: z.string().trim().max(300).optional().nullable(),
    roomCount: z.string().trim().max(50).optional().nullable(),
    area: z.string().trim().max(100).optional().nullable(),
    ownerName: z.string().trim().max(200).optional().nullable(),
    imageUrl: z.string().trim().url().max(3000).optional().nullable(),
    ownerPhone: z.unknown().optional(),
    ownerPhoneNormalized: z.unknown().optional(),
    phone: z.unknown().optional(),
    phoneNumber: z.unknown().optional(),
    sellerPhone: z.unknown().optional(),
  })
  .strict();

export type HuntingImportListing = Omit<
  z.infer<typeof huntingImportListingSchema>,
  (typeof sensitivePhoneFields)[number]
>;

type ImportResult = {
  listings: HuntingImportListing[];
  sourceFile: string;
  ignoredSensitiveFieldCount: number;
};

type ImportFile = {
  fileName: string;
  mimeType?: string;
  bytes: Uint8Array;
};

function normalizePayload(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.listings)) return record.listings;
    if (Array.isArray(record.data)) return record.data;
  }
  throw new Error(
    'Dosyada ilan listesi bulunamadı. JSON dizisi veya “listings” alanı bekleniyor.'
  );
}

function sanitizeListings(payload: unknown): {
  listings: HuntingImportListing[];
  ignoredSensitiveFieldCount: number;
} {
  const parsed = z
    .array(huntingImportListingSchema)
    .min(1, 'Dosyada en az bir ilan bulunmalıdır.')
    .max(
      HUNTING_IMPORT_MAX_LISTINGS,
      `Tek seferde en fazla ${HUNTING_IMPORT_MAX_LISTINGS} ilan yüklenebilir.`
    )
    .parse(normalizePayload(payload));

  let ignoredSensitiveFieldCount = 0;
  const listings = parsed.map((item) => {
    const clean = { ...item } as Record<string, unknown>;
    const containedSensitiveField = sensitivePhoneFields.some((field) => {
      const value = clean[field];
      delete clean[field];
      return value !== undefined && value !== null && value !== '';
    });
    if (containedSensitiveField) ignoredSensitiveFieldCount += 1;
    return clean as HuntingImportListing;
  });

  return { listings, ignoredSensitiveFieldCount };
}

export function parseHuntingImportPayload(
  payload: unknown,
  sourceFile = 'api.json'
): ImportResult {
  return {
    ...sanitizeListings(payload),
    sourceFile,
  };
}

export function assertSafeZipEntryName(entryName: string) {
  const normalized = entryName.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalized) ||
    segments.includes('..')
  ) {
    throw new Error('ZIP içindeki dosya yolu güvenli değil.');
  }
}

function parseJsonBytes(bytes: Uint8Array, sourceFile: string): ImportResult {
  if (bytes.byteLength > HUNTING_IMPORT_MAX_JSON_BYTES) {
    throw new Error('İlan JSON dosyası en fazla 5 MB olabilir.');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new Error('İlan JSON dosyası okunamadı veya geçerli JSON değil.');
  }
  return parseHuntingImportPayload(payload, sourceFile);
}

function parseZip(bytes: Uint8Array): ImportResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(Buffer.from(bytes));
  } catch {
    throw new Error('ZIP dosyası açılamadı veya bozuk.');
  }

  const entries = zip.getEntries();
  if (entries.length > HUNTING_IMPORT_MAX_ZIP_ENTRIES) {
    throw new Error(
      `ZIP paketi en fazla ${HUNTING_IMPORT_MAX_ZIP_ENTRIES} dosya içerebilir.`
    );
  }
  for (const entry of entries) assertSafeZipEntryName(entry.entryName);

  const jsonEntries = entries
    .filter(
      (entry) =>
        !entry.isDirectory &&
        entry.entryName.toLocaleLowerCase('tr-TR').endsWith('.json')
    )
    .sort((left, right) => {
      const preferred = /(?:jasmine_ilanlar|listings|portfoy)/i;
      return Number(preferred.test(right.entryName)) -
        Number(preferred.test(left.entryName));
    });

  const dataEntries = jsonEntries.filter(
    (entry) => !/(?:^|\/)manifest\.json$/i.test(entry.entryName)
  );
  if (dataEntries.length === 0) {
    if (jsonEntries.some((entry) => /manifest\.json$/i.test(entry.entryName))) {
      throw new Error(
        'Bu dosya eklenti kurulum paketidir. Buraya eklentinin dışa aktardığı ilan ZIP/JSON paketi yüklenmelidir.'
      );
    }
    throw new Error('ZIP paketinde ilan verisi içeren JSON dosyası bulunamadı.');
  }

  let lastError: unknown;
  for (const entry of dataEntries) {
    if (entry.header.size > HUNTING_IMPORT_MAX_JSON_BYTES) {
      lastError = new Error('İlan JSON dosyası en fazla 5 MB olabilir.');
      continue;
    }
    try {
      return parseJsonBytes(entry.getData(), entry.entryName);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('ZIP paketindeki ilan verisi okunamadı.');
}

export function parseHuntingImportPackage(input: ImportFile): ImportResult {
  if (input.bytes.byteLength > HUNTING_IMPORT_MAX_BYTES) {
    throw new Error('İçe aktarma dosyası en fazla 10 MB olabilir.');
  }

  const fileName = input.fileName.trim();
  const lowerName = fileName.toLocaleLowerCase('tr-TR');
  if (lowerName.endsWith('.json')) {
    return parseJsonBytes(input.bytes, fileName);
  }
  if (lowerName.endsWith('.zip')) {
    return parseZip(input.bytes);
  }

  throw new Error('Yalnızca .json veya .zip ilan paketi yüklenebilir.');
}

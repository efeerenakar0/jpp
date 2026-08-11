import { z } from 'zod';
import {
  ADDRESS_PRECISIONS,
  SOURCE_PROVIDERS,
} from './types';
import type {
  ParsedListingDetail,
  ParsedSearchListing,
} from './types';

export const huntWorkerProgressSchema = z
  .object({
    discovered: z.number().int().min(0).max(11),
    completed: z.number().int().min(0).max(11),
    partial: z.number().int().min(0).max(11),
    failed: z.number().int().min(0).max(11),
  })
  .strict();

export type HuntWorkerProgress = z.infer<typeof huntWorkerProgressSchema>;

export const huntWorkerJobSchema = z
  .object({
    id: z.string().min(1).max(160),
    provider: z.enum(SOURCE_PROVIDERS),
    searchUrl: z.string().url().max(3000),
    status: z.enum([
      'QUEUED',
      'RUNNING',
      'PAUSED',
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'CANCELLED',
      'SOURCE_CHALLENGE',
    ]),
    startedAt: z.string().datetime().nullable(),
  })
  .strict();

export type HuntWorkerJob = z.infer<typeof huntWorkerJobSchema>;

export const huntWorkerSearchListingSchema = z
  .object({
    sourceListingId: z.string().min(1).max(160),
    sourceUrl: z.string().url().max(3000),
    title: z.string().trim().min(1).max(500),
    priceText: z.string().trim().max(160).nullable(),
    locationText: z.string().trim().max(500).nullable(),
  })
  .strict();

const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable();

export const huntWorkerListingDetailSchema = z
  .object({
    sourceListingId: z.string().min(1).max(160),
    sourceUrl: z.string().url().max(3000),
    title: z.string().trim().min(1).max(500),
    priceText: nullableText(160),
    priceAmount: z.number().finite().nonnegative().max(10 ** 15).nullable(),
    currency: nullableText(12),
    listingPublishedAt: z.string().datetime().nullable(),
    category: nullableText(160),
    subcategory: nullableText(300),
    sellerType: nullableText(160),
    sellerName: nullableText(300),
    phones: z.array(z.string().regex(/^90[1-9]\d{9}$/)).max(10),
    descriptionText: nullableText(100_000),
    sanitizedDescriptionHtml: nullableText(150_000),
    province: nullableText(160),
    district: nullableText(160),
    neighborhood: nullableText(200),
    street: nullableText(300),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    addressPrecision: z.enum(ADDRESS_PRECISIONS),
    attributes: z
      .record(z.string().min(1).max(160), z.string().max(2000))
      .refine((value) => Object.keys(value).length <= 100, {
        message: 'En fazla 100 ilan ozelligi kabul edilir.',
      }),
    images: z
      .array(
        z
          .object({
            order: z.number().int().min(0).max(500),
            sourceUrl: z.string().url().max(3000),
            mimeType: nullableText(100),
            width: z.number().int().positive().max(50_000).nullable(),
            height: z.number().int().positive().max(50_000).nullable(),
          })
          .strict()
      )
      .max(100),
    completenessScore: z.number().int().min(0).max(100),
  })
  .strict();

export const huntWorkerInvocationSchema = z
  .object({
    version: z.literal(1),
    jobId: z.string().min(1).max(160),
    capability: z.string().min(32).max(2048),
  })
  .strict();

const jobAction = z.object({
  jobId: z.string().min(1).max(160),
});

export const huntWorkerRequestSchema = z.discriminatedUnion('action', [
  jobAction.extend({ action: z.literal('claim') }).strict(),
  jobAction.extend({ action: z.literal('control') }).strict(),
  jobAction
    .extend({
      action: z.literal('discover'),
      items: z.array(huntWorkerSearchListingSchema).min(1).max(11),
      progress: huntWorkerProgressSchema,
    })
    .strict(),
  jobAction
    .extend({
      action: z.literal('detail'),
      detail: huntWorkerListingDetailSchema,
      progress: huntWorkerProgressSchema,
    })
    .strict(),
  jobAction
    .extend({
      action: z.literal('progress'),
      progress: huntWorkerProgressSchema,
      errorCode: z.enum(['REQUEST_FAILED']).optional(),
      errorSummary: z.string().trim().max(1000).optional(),
    })
    .strict(),
  jobAction
    .extend({
      action: z.literal('finish'),
      outcome: z.enum([
        'COMPLETED',
        'PARTIAL',
        'SOURCE_CHALLENGE',
        'FAILED',
      ]),
      progress: huntWorkerProgressSchema,
      errorSummary: z.string().trim().max(1000).optional(),
    })
    .strict(),
]);

export type HuntWorkerRequest = z.infer<typeof huntWorkerRequestSchema>;

export function detailToWire(detail: ParsedListingDetail) {
  return huntWorkerListingDetailSchema.parse({
    ...detail,
    listingPublishedAt: detail.listingPublishedAt?.toISOString() || null,
  });
}

export function detailFromWire(
  detail: z.infer<typeof huntWorkerListingDetailSchema>
): ParsedListingDetail {
  return {
    ...detail,
    listingPublishedAt: detail.listingPublishedAt
      ? new Date(detail.listingPublishedAt)
      : null,
  };
}

export function searchListingsFromWire(
  items: z.infer<typeof huntWorkerSearchListingSchema>[]
): ParsedSearchListing[] {
  return items;
}

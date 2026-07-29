import { z } from 'zod';

const documentValueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(100),
  z.null(),
]);

export const documentValuesSchema = z
  .record(z.string().min(1).max(100), documentValueSchema)
  .superRefine((values, context) => {
    if (Object.keys(values).length > 250) {
      context.addIssue({
        code: 'custom',
        message: 'Bir belgede en fazla 250 alan bulunabilir.',
      });
    }

    if (JSON.stringify(values).length > 120_000) {
      context.addIssue({
        code: 'custom',
        message: 'Belge verisi izin verilen boyutu aşıyor.',
      });
    }
  });

export const createDocumentSchema = z.object({
  templateKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(2).max(180).optional(),
  values: documentValuesSchema.default({}),
  generate: z.boolean().default(false),
});

export const updateDocumentSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('SAVE'),
    title: z.string().trim().min(2).max(180),
    values: documentValuesSchema,
  }),
  z.object({
    action: z.literal('GENERATE'),
    title: z.string().trim().min(2).max(180),
    values: documentValuesSchema,
  }),
  z.object({ action: z.literal('ARCHIVE') }),
  z.object({ action: z.literal('CANCEL') }),
  z.object({ action: z.literal('RESTORE') }),
  z.object({ action: z.literal('DUPLICATE') }),
]);

export const favoriteDocumentTemplateSchema = z.object({
  favorite: z.boolean(),
});

export const documentListQuerySchema = z.object({
  query: z.string().trim().max(120).optional().default(''),
  status: z
    .enum(['ALL', 'DRAFT', 'GENERATED', 'ARCHIVED', 'CANCELLED', 'DELETED'])
    .optional()
    .default('ALL'),
  category: z.string().trim().max(80).optional().default('ALL'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

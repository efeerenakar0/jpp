import 'server-only';

import { randomBytes } from 'node:crypto';
import {
  DocumentAuditAction,
  DocumentRecordStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import type { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { documentTemplates, getDocumentTemplate } from './catalog';
import {
  createDocumentSnapshot,
  validateDocumentValues,
} from './engine';
import type {
  DocumentContextDTO,
  DocumentTemplateDefinition,
  DocumentValues,
} from './types';
import {
  buildCompanyDocumentScope,
  type DocumentListStatus,
} from './scope';

type FabrikaPrincipal = Awaited<ReturnType<typeof requireFabrikaPrincipal>>;
const jsonValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

let templateSyncPromise: Promise<void> | null = null;

export class DocumentCenterError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'DocumentCenterError';
    this.status = status;
    this.details = details;
  }
}

function actor(principal: FabrikaPrincipal) {
  return {
    actorType: principal.type,
    actorId:
      principal.type === 'OWNER' ? principal.account.id : principal.member.id,
    actorName: principal.displayName,
    actorKey: `${principal.type}:${
      principal.type === 'OWNER' ? principal.account.id : principal.member.id
    }`,
  };
}

function makeDocumentNumber() {
  const date = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\D/g, '');
  return `JAS-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function getDocumentPrincipalKey(principal: FabrikaPrincipal) {
  return actor(principal).actorKey;
}

export async function syncDocumentTemplates() {
  if (!templateSyncPromise) {
    templateSyncPromise = prisma
      .$transaction(
        documentTemplates.map((template) =>
          prisma.documentTemplate.upsert({
            where: {
              key_version: { key: template.key, version: template.version },
            },
            update: {
              name: template.name,
              category: template.category,
              description: template.description,
              estimatedMinutes: template.estimatedMinutes,
              active: template.active,
              lastReviewedAt: new Date(template.lastReviewedAt),
              legalStatus: template.legalStatus,
              legalNotice: template.legalNotice,
              officialFormWarning: template.officialFormWarning ?? null,
              schema: jsonValue(template.fields),
              content: jsonValue(template.sections),
              sources: jsonValue(template.sources),
              signatureRoles: jsonValue(template.signatureRoles),
              tags: template.tags,
            },
            create: {
              key: template.key,
              name: template.name,
              category: template.category,
              description: template.description,
              estimatedMinutes: template.estimatedMinutes,
              version: template.version,
              active: template.active,
              lastReviewedAt: new Date(template.lastReviewedAt),
              legalStatus: template.legalStatus,
              legalNotice: template.legalNotice,
              officialFormWarning: template.officialFormWarning ?? null,
              schema: jsonValue(template.fields),
              content: jsonValue(template.sections),
              sources: jsonValue(template.sources),
              signatureRoles: jsonValue(template.signatureRoles),
              tags: template.tags,
            },
          })
        )
      )
      .then(() => undefined)
      .catch((error) => {
        templateSyncPromise = null;
        throw error;
      });
  }

  await templateSyncPromise;
}

export async function getDocumentContext(
  principal: FabrikaPrincipal
): Promise<DocumentContextDTO> {
  const [contacts, properties] = await Promise.all([
    prisma.crmContact.findMany({
      where: { companyAccountId: principal.account.id },
      orderBy: { updatedAt: 'desc' },
      take: 250,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        type: true,
      },
    }),
    prisma.crmProperty.findMany({
      where: {
        companyAccountId: principal.account.id,
        status: { not: 'ARCHIVED' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 250,
      select: {
        id: true,
        title: true,
        referenceCode: true,
        location: true,
        price: true,
        roomCount: true,
        area: true,
        ownerContactId: true,
        ownerContact: { select: { name: true } },
      },
    }),
  ]);

  return {
    company: {
      id: principal.account.id,
      name: principal.account.companyName,
      ownerName: principal.account.ownerName,
      ownerEmail: principal.account.ownerEmail,
      ownerPhone: principal.account.ownerPhone,
      logo: principal.account.brandLogoData,
    },
    principal: {
      type: principal.type,
      id:
        principal.type === 'OWNER'
          ? principal.account.id
          : principal.member.id,
      name: principal.displayName,
      email:
        principal.type === 'OWNER'
          ? principal.account.ownerEmail
          : principal.member.email,
      phone:
        principal.type === 'OWNER'
          ? principal.account.ownerPhone
          : principal.member.phone,
    },
    contacts,
    properties: properties.map(({ ownerContact, ...property }) => ({
      ...property,
      ownerName: ownerContact?.name ?? null,
    })),
  };
}

export async function listDocumentTemplates(principal: FabrikaPrincipal) {
  await syncDocumentTemplates();
  const actorKey = getDocumentPrincipalKey(principal);
  const favorites = await prisma.documentFavorite.findMany({
    where: { companyAccountId: principal.account.id, actorKey },
    select: { templateKey: true },
  });
  const favoriteKeys = new Set(favorites.map((item) => item.templateKey));

  return documentTemplates.map((template) => ({
    ...template,
    favorite: favoriteKeys.has(template.key),
  }));
}

function documentListWhere(
  principal: FabrikaPrincipal,
  input: {
    query?: string;
    status?: DocumentListStatus;
    category?: string;
    from?: string;
    to?: string;
  }
): Prisma.CompanyDocumentWhereInput {
  return buildCompanyDocumentScope({
    companyAccountId: principal.account.id,
    principalType: principal.type,
    ...input,
  });
}

export async function listDocuments(
  principal: FabrikaPrincipal,
  input: {
    query?: string;
    status?: DocumentListStatus;
    category?: string;
    from?: string;
    to?: string;
  } = {}
) {
  return prisma.companyDocument.findMany({
    where: documentListWhere(principal, input),
    orderBy: { updatedAt: 'desc' },
    take: 300,
    select: {
      publicId: true,
      documentNumber: true,
      title: true,
      status: true,
      legalStatus: true,
      templateKey: true,
      templateVersion: true,
      versionGroupId: true,
      versionNumber: true,
      generatedAt: true,
      archivedAt: true,
      cancelledAt: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      createdByName: true,
      lastEditedByName: true,
      template: {
        select: { name: true, category: true, description: true },
      },
    },
  });
}

export async function getDocument(
  principal: FabrikaPrincipal,
  publicId: string,
  options: { includeDeleted?: boolean; auditView?: boolean } = {}
) {
  const document = await prisma.companyDocument.findFirst({
    where: {
      publicId,
      companyAccountId: principal.account.id,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
    },
    include: {
      template: {
        select: { name: true, category: true, description: true },
      },
    },
  });

  if (!document) {
    throw new DocumentCenterError('Belge bulunamadı.', 404);
  }

  if (options.auditView) {
    const currentActor = actor(principal);
    await prisma.documentAuditLog.create({
      data: {
        companyAccountId: principal.account.id,
        documentId: document.id,
        action: 'VIEWED',
        actorType: currentActor.actorType,
        actorId: currentActor.actorId,
        actorName: currentActor.actorName,
        metadata: { publicId: document.publicId },
      },
    });
  }

  return document;
}

function minimalContextSnapshot(context: DocumentContextDTO) {
  return {
    company: {
      id: context.company.id,
      name: context.company.name,
      ownerName: context.company.ownerName,
      logo: context.company.logo,
    },
    principal: {
      type: context.principal.type,
      id: context.principal.id,
      name: context.principal.name,
    },
  };
}

export async function createDocument(
  principal: FabrikaPrincipal,
  input: {
    templateKey: string;
    title?: string;
    values: DocumentValues;
    generate: boolean;
  }
) {
  await syncDocumentTemplates();
  const definition = getDocumentTemplate(input.templateKey);
  const template = await prisma.documentTemplate.findUnique({
    where: {
      key_version: {
        key: definition.key,
        version: definition.version,
      },
    },
  });
  if (!template || !template.active) {
    throw new DocumentCenterError('Belge şablonu kullanımda değil.', 409);
  }

  const context = await getDocumentContext(principal);
  const currentActor = actor(principal);
  const documentNumber = makeDocumentNumber();
  const values: DocumentValues = {
    ...input.values,
    documentNumber,
    companyName:
      typeof input.values.companyName === 'string'
        ? input.values.companyName
        : principal.account.companyName,
    advisorName:
      typeof input.values.advisorName === 'string'
        ? input.values.advisorName
        : principal.displayName,
    issueDate:
      typeof input.values.issueDate === 'string'
        ? input.values.issueDate
        : new Date().toISOString().slice(0, 10),
  };

  let renderedSnapshot: Prisma.InputJsonValue | undefined;
  if (input.generate) {
    const validation = validateDocumentValues(definition, values);
    if (!validation.valid) {
      throw new DocumentCenterError(
        'Belge oluşturulmadan önce zorunlu alanları tamamlayın.',
        422,
        validation.errors
      );
    }
    renderedSnapshot = jsonValue(createDocumentSnapshot(definition, values));
  }

  return prisma.$transaction(async (tx) => {
    const document = await tx.companyDocument.create({
      data: {
        companyAccountId: principal.account.id,
        templateId: template.id,
        documentNumber,
        title: input.title || definition.name,
        status: input.generate ? 'GENERATED' : 'DRAFT',
        legalStatus: definition.legalStatus,
        templateKey: definition.key,
        templateVersion: definition.version,
        values: jsonValue(values),
        templateSnapshot: jsonValue(definition),
        renderedSnapshot,
        contextSnapshot: jsonValue(minimalContextSnapshot(context)),
        createdByType: currentActor.actorType,
        createdById: currentActor.actorId,
        createdByName: currentActor.actorName,
        lastEditedByType: currentActor.actorType,
        lastEditedById: currentActor.actorId,
        lastEditedByName: currentActor.actorName,
        generatedAt: input.generate ? new Date() : null,
      },
    });
    await tx.documentAuditLog.create({
      data: {
        companyAccountId: principal.account.id,
        documentId: document.id,
        action: input.generate ? 'GENERATED' : 'CREATED',
        actorType: currentActor.actorType,
        actorId: currentActor.actorId,
        actorName: currentActor.actorName,
        metadata: {
          publicId: document.publicId,
          templateKey: definition.key,
          versionNumber: document.versionNumber,
        },
      },
    });
    return document;
  });
}

function templateFromSnapshot(value: Prisma.JsonValue) {
  return value as unknown as DocumentTemplateDefinition;
}

function valuesFromJson(value: Prisma.JsonValue) {
  return value as unknown as DocumentValues;
}

export async function updateDocument(
  principal: FabrikaPrincipal,
  publicId: string,
  input:
    | { action: 'SAVE' | 'GENERATE'; title: string; values: DocumentValues }
    | { action: 'ARCHIVE' | 'CANCEL' | 'RESTORE' | 'DUPLICATE' }
) {
  const includeDeleted = input.action === 'RESTORE';
  const document = await getDocument(principal, publicId, { includeDeleted });
  const currentActor = actor(principal);

  if (input.action === 'RESTORE') {
    if (principal.type !== 'OWNER') {
      throw new DocumentCenterError(
        'Silinen belgeleri yalnızca şirket patronu geri yükleyebilir.',
        403
      );
    }
    const restored = await prisma.companyDocument.update({
      where: { id: document.id },
      data: { deletedAt: null },
    });
    await writeAudit(principal, document.id, 'RESTORED', { publicId });
    return restored;
  }

  if (input.action === 'DUPLICATE') {
    const latestVersion = await prisma.companyDocument.aggregate({
      where: {
        companyAccountId: principal.account.id,
        versionGroupId: document.versionGroupId,
      },
      _max: { versionNumber: true },
    });
    const nextVersion = (latestVersion._max.versionNumber ?? 0) + 1;
    const duplicatedNumber = makeDocumentNumber();
    const duplicatedValues = {
      ...valuesFromJson(document.values),
      documentNumber: duplicatedNumber,
    };
    return prisma.$transaction(async (tx) => {
      const duplicated = await tx.companyDocument.create({
        data: {
          companyAccountId: principal.account.id,
          templateId: document.templateId,
          documentNumber: duplicatedNumber,
          title: `${document.title} · Sürüm ${nextVersion}`,
          status: 'DRAFT',
          legalStatus: document.legalStatus,
          templateKey: document.templateKey,
          templateVersion: document.templateVersion,
          values: jsonValue(duplicatedValues),
          templateSnapshot: document.templateSnapshot as Prisma.InputJsonValue,
          contextSnapshot: document.contextSnapshot as Prisma.InputJsonValue,
          versionGroupId: document.versionGroupId,
          versionNumber: nextVersion,
          parentDocumentId: document.id,
          createdByType: currentActor.actorType,
          createdById: currentActor.actorId,
          createdByName: currentActor.actorName,
          lastEditedByType: currentActor.actorType,
          lastEditedById: currentActor.actorId,
          lastEditedByName: currentActor.actorName,
        },
      });
      await tx.documentAuditLog.create({
        data: {
          companyAccountId: principal.account.id,
          documentId: duplicated.id,
          action: 'DUPLICATED',
          actorType: currentActor.actorType,
          actorId: currentActor.actorId,
          actorName: currentActor.actorName,
          metadata: {
            sourcePublicId: document.publicId,
            publicId: duplicated.publicId,
            versionNumber: nextVersion,
          },
        },
      });
      return duplicated;
    });
  }

  if (input.action === 'ARCHIVE') {
    if (document.status !== 'GENERATED') {
      throw new DocumentCenterError(
        'Yalnızca oluşturulmuş belgeler arşivlenebilir.',
        409
      );
    }
    const archived = await prisma.companyDocument.update({
      where: { id: document.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await writeAudit(principal, document.id, 'ARCHIVED', { publicId });
    return archived;
  }

  if (input.action === 'CANCEL') {
    if (document.status === 'ARCHIVED') {
      throw new DocumentCenterError('Arşivlenmiş belge iptal edilemez.', 409);
    }
    const cancelled = await prisma.companyDocument.update({
      where: { id: document.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await writeAudit(principal, document.id, 'CANCELLED', { publicId });
    return cancelled;
  }

  if (document.status !== 'DRAFT') {
    throw new DocumentCenterError(
      'Oluşturulmuş belge değiştirilemez. Yeni sürüm oluşturun.',
      409
    );
  }

  if (input.action !== 'SAVE' && input.action !== 'GENERATE') {
    throw new DocumentCenterError('Geçersiz belge işlemi.', 400);
  }

  const definition = templateFromSnapshot(document.templateSnapshot);
  const values: DocumentValues = {
    ...input.values,
    documentNumber: document.documentNumber,
  };
  let renderedSnapshot: Prisma.InputJsonValue | undefined;
  if (input.action === 'GENERATE') {
    const validation = validateDocumentValues(definition, values);
    if (!validation.valid) {
      throw new DocumentCenterError(
        'Belge oluşturulmadan önce zorunlu alanları tamamlayın.',
        422,
        validation.errors
      );
    }
    renderedSnapshot = jsonValue(createDocumentSnapshot(definition, values));
  }

  const updated = await prisma.companyDocument.update({
    where: { id: document.id },
    data: {
      title: input.title,
      values: jsonValue(values),
      renderedSnapshot,
      status: input.action === 'GENERATE' ? 'GENERATED' : 'DRAFT',
      generatedAt: input.action === 'GENERATE' ? new Date() : null,
      lastEditedByType: currentActor.actorType,
      lastEditedById: currentActor.actorId,
      lastEditedByName: currentActor.actorName,
    },
  });
  await writeAudit(
    principal,
    document.id,
    input.action === 'GENERATE' ? 'GENERATED' : 'UPDATED',
    { publicId, versionNumber: document.versionNumber }
  );
  return updated;
}

export async function softDeleteDocument(
  principal: FabrikaPrincipal,
  publicId: string
) {
  if (principal.type !== 'OWNER') {
    throw new DocumentCenterError(
      'Belgeleri yalnızca şirket patronu silebilir.',
      403
    );
  }
  const document = await getDocument(principal, publicId);
  const deleted = await prisma.companyDocument.update({
    where: { id: document.id },
    data: { deletedAt: new Date() },
  });
  await writeAudit(principal, document.id, 'SOFT_DELETED', { publicId });
  return deleted;
}

export async function setTemplateFavorite(
  principal: FabrikaPrincipal,
  templateKey: string,
  favorite: boolean
) {
  getDocumentTemplate(templateKey);
  const currentActor = actor(principal);
  if (favorite) {
    await prisma.documentFavorite.upsert({
      where: {
        companyAccountId_actorKey_templateKey: {
          companyAccountId: principal.account.id,
          actorKey: currentActor.actorKey,
          templateKey,
        },
      },
      update: {},
      create: {
        companyAccountId: principal.account.id,
        actorKey: currentActor.actorKey,
        templateKey,
      },
    });
    await writeAudit(principal, null, 'FAVORITED', { templateKey });
  } else {
    await prisma.documentFavorite.deleteMany({
      where: {
        companyAccountId: principal.account.id,
        actorKey: currentActor.actorKey,
        templateKey,
      },
    });
    await writeAudit(principal, null, 'UNFAVORITED', { templateKey });
  }
}

export async function writeAudit(
  principal: FabrikaPrincipal,
  documentId: string | null,
  action: DocumentAuditAction,
  metadata?: Record<string, string | number | boolean | null>
) {
  const currentActor = actor(principal);
  await prisma.documentAuditLog.create({
    data: {
      companyAccountId: principal.account.id,
      documentId,
      action,
      actorType: currentActor.actorType,
      actorId: currentActor.actorId,
      actorName: currentActor.actorName,
      metadata: metadata ? jsonValue(metadata) : undefined,
    },
  });
}

export function getRenderedSnapshot(document: {
  renderedSnapshot: Prisma.JsonValue | null;
  status: DocumentRecordStatus;
}) {
  if (!document.renderedSnapshot) {
    throw new DocumentCenterError(
      'PDF veya DOCX için önce belgeyi oluşturun.',
      409
    );
  }
  return document.renderedSnapshot as unknown as ReturnType<
    typeof createDocumentSnapshot
  >;
}

export function getStoredValues(document: { values: Prisma.JsonValue }) {
  return valuesFromJson(document.values);
}

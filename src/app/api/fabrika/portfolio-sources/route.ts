import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  fetchPortfolioSource,
  isPortfolioSourceType,
  PORTFOLIO_SOURCE_TYPES,
} from '@/lib/portfolio-connectors';
import {
  encryptPortfolioCredential,
  portfolioCredentialHint,
} from '@/lib/portfolio-source-credentials';
import prisma from '@/lib/prisma';

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(PORTFOLIO_SOURCE_TYPES),
  baseUrl: z.string().trim().url().max(500),
  feedPath: z.string().trim().max(500).optional().nullable(),
  apiKey: z.string().trim().max(1000).optional().nullable(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync'), id: z.string().trim().min(1) }),
  z.object({
    action: z.literal('toggle'),
    id: z.string().trim().min(1),
    active: z.boolean(),
  }),
]);

function sessionError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json(
      { success: false, error: 'Fabrika oturumu gerekli.' },
      { status: 401 }
    );
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 403 }
    );
  }
  return null;
}

async function sourceData(companyAccountId: string, canManageSecrets: boolean) {
  const [sources, groupedImports] = await Promise.all([
    prisma.portfolioSource.findMany({
      where: { companyAccountId },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        feedPath: true,
        credentialHint: true,
        active: true,
        lastSyncStatus: true,
        lastSyncError: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { imports: true } },
      },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.portfolioImportItem.groupBy({
      by: ['status'],
      where: { companyAccountId },
      _count: { _all: true },
    }),
  ]);
  const counts = Object.fromEntries(
    groupedImports.map((group) => [group.status, group._count._all])
  );
  return {
    sources,
    permissions: { canManageSecrets },
    metrics: {
      activeSources: sources.filter((source) => source.active).length,
      pendingImports: counts.PENDING || 0,
      approvedImports: counts.APPROVED || 0,
      sourceErrors: sources.filter(
        (source) => source.lastSyncStatus === 'ERROR'
      ).length,
    },
  };
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    return NextResponse.json({
      success: true,
      data: await sourceData(
        principal.account.id,
        principal.permissions.canManageSecrets
      ),
    });
  } catch (error) {
    return (
      sessionError(error) ||
      NextResponse.json(
        { success: false, error: 'Portföy kaynakları yüklenemedi.' },
        { status: 500 }
      )
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = sourceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message || 'Kaynak bilgileri geçersiz.',
        },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const apiKey = input.apiKey?.trim();
    const source = await prisma.portfolioSource.create({
      data: {
        companyAccountId: principal.account.id,
        name: input.name,
        type: input.type,
        baseUrl: new URL(input.baseUrl).toString(),
        feedPath: input.feedPath?.trim() || null,
        encryptedCredential: apiKey
          ? encryptPortfolioCredential(apiKey)
          : null,
        credentialHint: apiKey ? portfolioCredentialHint(apiKey) : null,
      },
      select: { id: true },
    });
    return NextResponse.json(
      {
        success: true,
        message: 'Portföy kaynağı oluşturuldu.',
        sourceId: source.id,
        data: await sourceData(
          principal.account.id,
          principal.permissions.canManageSecrets
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Portfolio source create error:', error);
    return (
      sessionError(error) ||
      NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Portföy kaynağı oluşturulamadı.',
        },
        { status: 500 }
      )
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kaynak işlemi.' },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const source = await prisma.portfolioSource.findFirst({
      where: { id: input.id, companyAccountId: principal.account.id },
    });
    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Portföy kaynağı bulunamadı.' },
        { status: 404 }
      );
    }

    if (input.action === 'toggle') {
      if (!principal.permissions.canManageSecrets) {
        throw new FabrikaForbiddenError(
          'Kaynak durumunu yalnızca şirket patronu değiştirebilir.'
        );
      }
      await prisma.portfolioSource.update({
        where: { id: source.id },
        data: { active: input.active },
      });
      return NextResponse.json({
        success: true,
        message: input.active ? 'Kaynak etkinleştirildi.' : 'Kaynak durduruldu.',
        data: await sourceData(
          principal.account.id,
          principal.permissions.canManageSecrets
        ),
      });
    }

    if (!source.active) {
      return NextResponse.json(
        { success: false, error: 'Senkron için önce kaynağı etkinleştirin.' },
        { status: 400 }
      );
    }
    if (!isPortfolioSourceType(source.type)) {
      return NextResponse.json(
        { success: false, error: 'Kaynak türü desteklenmiyor.' },
        { status: 400 }
      );
    }
    await prisma.portfolioSource.update({
      where: { id: source.id },
      data: { lastSyncStatus: 'SYNCING', lastSyncError: null },
    });
    try {
      const items = await fetchPortfolioSource(source);
      const existing = await prisma.portfolioImportItem.findMany({
        where: {
          companyAccountId: principal.account.id,
          fingerprint: { in: items.map((item) => item.fingerprint) },
        },
        select: { fingerprint: true },
      });
      const existingFingerprints = new Set(
        existing.map((item) => item.fingerprint)
      );
      for (const item of items) {
        await prisma.portfolioImportItem.upsert({
          where: {
            companyAccountId_fingerprint: {
              companyAccountId: principal.account.id,
              fingerprint: item.fingerprint,
            },
          },
          create: {
            companyAccountId: principal.account.id,
            sourceId: source.id,
            ...item,
          },
          update: {
            sourceId: source.id,
            externalId: item.externalId,
            sourceUrl: item.sourceUrl,
            title: item.title,
            location: item.location,
            price: item.price,
            roomCount: item.roomCount,
            area: item.area,
            description: item.description,
            imageUrl: item.imageUrl,
            rawPayload: item.rawPayload,
          },
        });
      }
      await prisma.portfolioSource.update({
        where: { id: source.id },
        data: {
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
          lastSyncedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        message: `${items.length} kayıt incelendi, ${
          items.filter((item) => !existingFingerprints.has(item.fingerprint))
            .length
        } yeni kayıt onaya gönderildi.`,
        data: await sourceData(
          principal.account.id,
          principal.permissions.canManageSecrets
        ),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kaynak eşitlenemedi.';
      await prisma.portfolioSource.update({
        where: { id: source.id },
        data: { lastSyncStatus: 'ERROR', lastSyncError: message },
      });
      return NextResponse.json(
        { success: false, error: message },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('Portfolio source action error:', error);
    return (
      sessionError(error) ||
      NextResponse.json(
        { success: false, error: 'Kaynak işlemi tamamlanamadı.' },
        { status: 500 }
      )
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Kaynak kimliği gerekli.' },
        { status: 400 }
      );
    }
    const deleted = await prisma.portfolioSource.deleteMany({
      where: { id, companyAccountId: principal.account.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Portföy kaynağı bulunamadı.' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: 'Portföy kaynağı kaldırıldı; geçmiş onay kayıtları korundu.',
      data: await sourceData(
        principal.account.id,
        principal.permissions.canManageSecrets
      ),
    });
  } catch (error) {
    console.error('Portfolio source delete error:', error);
    return (
      sessionError(error) ||
      NextResponse.json(
        { success: false, error: 'Portföy kaynağı kaldırılamadı.' },
        { status: 500 }
      )
    );
  }
}

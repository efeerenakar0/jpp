import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  AuthorizedPoolError,
  authorizedPoolFiltersSchema,
  decideAuthorizedPoolContact,
  decidePoolContactSchema,
  listAuthorizedPortfolioPool,
  listPoolManagement,
  publishAuthorizedPoolShare,
  publishPoolShareSchema,
  requestAuthorizedPoolContact,
  requestPoolContactSchema,
  updateAuthorizedPoolShare,
  updatePoolShareSchema,
} from '@/lib/authorized-portfolio-pool-service';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';

function principalRef(principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>) {
  return {
    type: principal.type,
    id: principal.type === 'OWNER' ? principal.account.id : principal.member.id,
  };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ success: false, error: 'Oturum gerekli.' }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: error.issues[0]?.message || 'Bilgileri kontrol edin.' },
      { status: 400 }
    );
  }
  if (error instanceof AuthorizedPoolError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : 409;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
  console.error(
    '[Authorized Portfolio Pool Error]',
    {
      type: error instanceof Error ? error.name : 'UnknownError',
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code).slice(0, 80)
          : undefined,
    }
  );
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const filters = authorizedPoolFiltersSchema.parse({
      query: url.searchParams.get('query') || undefined,
      location: url.searchParams.get('location') || undefined,
      roomCount: url.searchParams.get('roomCount') || undefined,
      propertyType: url.searchParams.get('propertyType') || undefined,
      minPrice: url.searchParams.get('minPrice') || undefined,
      maxPrice: url.searchParams.get('maxPrice') || undefined,
    });
    const now = new Date();
    const [listings, management] = await Promise.all([
      listAuthorizedPortfolioPool(principal.account.id, filters, now),
      principal.type === 'OWNER'
        ? listPoolManagement(principal.account.id, now)
        : Promise.resolve({
            ownedShares: [],
            incomingRequests: [],
            availableProperties: [],
          }),
    ]);
    return NextResponse.json({ success: true, listings, management });
  } catch (error) {
    return errorResponse(error, 'Yetkili portföy havuzu yüklenemedi.');
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const body = await request.json();
    const now = new Date();

    if (body?.action === 'publish') {
      if (principal.type !== 'OWNER') {
        return NextResponse.json(
          { success: false, error: 'Portföy paylaşımını yalnız patron yönetebilir.' },
          { status: 403 }
        );
      }
      const data = publishPoolShareSchema.parse(body);
      const share = await publishAuthorizedPoolShare({
        companyAccountId: principal.account.id,
        propertyId: data.propertyId,
        permissionReference: data.permissionReference,
        principal: principalRef(principal),
        now,
      });
      return NextResponse.json({ success: true, share }, { status: 201 });
    }

    if (body?.action === 'request-contact') {
      const data = requestPoolContactSchema.parse(body);
      const contactRequest = await requestAuthorizedPoolContact({
        requesterCompanyAccountId: principal.account.id,
        shareId: data.shareId,
        message: data.message,
        idempotencyKey: data.idempotencyKey,
        principal: principalRef(principal),
        now,
      });
      return NextResponse.json({ success: true, contactRequest }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz havuz işlemi.' },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error, 'Havuz işlemi tamamlanamadı.');
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Bu işlemi yalnız patron yapabilir.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const now = new Date();

    if (body?.action === 'update-share') {
      const data = updatePoolShareSchema.parse(body);
      const share = await updateAuthorizedPoolShare({
        companyAccountId: principal.account.id,
        shareId: data.shareId,
        status: data.status,
        reason: data.reason,
        principal: principalRef(principal),
        now,
      });
      return NextResponse.json({ success: true, share });
    }
    if (body?.action === 'decide-contact') {
      const data = decidePoolContactSchema.parse(body);
      const contactRequest = await decideAuthorizedPoolContact({
        ownerCompanyAccountId: principal.account.id,
        requestId: data.requestId,
        decision: data.decision,
        note: data.note,
        principal: principalRef(principal),
        now,
      });
      return NextResponse.json({ success: true, contactRequest });
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz havuz işlemi.' },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error, 'Havuz işlemi tamamlanamadı.');
  }
}

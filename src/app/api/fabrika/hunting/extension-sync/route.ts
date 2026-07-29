import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { createHuntJob } from '@/lib/hunting-v2/job-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';
import { assertAllowedSourceUrl } from '@/lib/hunting-v2/security';

export const runtime = 'nodejs';

const rowSchema = z
  .object({
    listingId: z.string().regex(/^\d{5,20}$/),
    url: z.string().url().max(3000),
    title: z.string().trim().min(2).max(300),
    price: z.string().trim().max(100).optional(),
    location: z.string().trim().max(300).optional(),
  })
  .strict();

const bodySchema = z
  .object({
    searchUrl: z.string().url().max(3000),
    sourceAuthorizationId: z.string().min(1).optional(),
    visibleRows: z.array(rowSchema).max(100).default([]),
    idempotencyKey: z.string().min(8).max(160).optional(),
  })
  .strict();

function allowedOrigins() {
  return new Set(
    (process.env.HUNTING_EXTENSION_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().has(origin)) {
    throw new Error('Eklenti origin değeri izinli değil.');
  }
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function attachAllowedCors(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins().has(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export async function OPTIONS(request: Request) {
  try {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...corsHeaders(request),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return attachAllowedCors(huntingApiError(error), request);
  }
}

export async function POST(request: Request) {
  try {
    const cors = corsHeaders(request);
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `extension:${principal.account.id}:${actor.key}`,
      { limit: 10, windowMs: 60_000 }
    );
    const body = bodySchema.parse(await request.json());
    assertAllowedSourceUrl(body.searchUrl, 'SAHIBINDEN');
    for (const row of body.visibleRows) {
      assertAllowedSourceUrl(row.url, 'SAHIBINDEN');
    }

    const job = await createHuntJob({
      companyAccountId: principal.account.id,
      createdBy: actor.key,
      body: {
        provider: 'SAHIBINDEN',
        searchUrl: body.searchUrl,
        sourceAuthorizationId: body.sourceAuthorizationId,
        idempotencyKey: body.idempotencyKey,
      },
    });

    for (const row of body.visibleRows) {
      await prisma.huntedListing.upsert({
        where: {
          companyAccountId_sourceProvider_sourceListingId: {
            companyAccountId: principal.account.id,
            sourceProvider: 'SAHIBINDEN',
            sourceListingId: row.listingId,
          },
        },
        update: {
          huntJobId: job.id,
          sourceUrl: row.url,
          title: row.title,
          price: row.price,
          location: row.location,
          lastSeenAt: new Date(),
        },
        create: {
          companyAccountId: principal.account.id,
          huntJobId: job.id,
          sourceProvider: 'SAHIBINDEN',
          sourceListingId: row.listingId,
          sourceUrl: row.url,
          title: row.title,
          price: row.price,
          location: row.location,
          acquisitionStatus: 'DISCOVERED',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: job.status,
        visibleRowsAccepted: body.visibleRows.length,
        jobUrl: `/fabrika/avci?job=${job.id}`,
      },
      { status: 202, headers: cors }
    );
  } catch (error) {
    return attachAllowedCors(huntingApiError(error), request);
  }
}

import { resolveCname } from 'node:dns/promises';
import { NextResponse } from 'next/server';
import type { DeveloperWorkspace, Prisma } from '@prisma/client';

import {
  buildPortfolioHostname,
  DEFAULT_CNAME_TARGET,
  developerWorkspaceRequestSchema,
  parseSocialAccounts,
  safeSiteSlug,
  upsertSocialAccount,
} from '@/lib/developer-workspace';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';
import { publicationEligibilityWhere } from '@/lib/property-publication';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const cnameTarget =
  process.env.VERCEL_PROJECT_CNAME_TARGET?.trim().replace(/\.$/, '') ||
  DEFAULT_CNAME_TARGET;

function appOrigin(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ||
    process.env.APP_URL?.trim().replace(/\/+$/, '') ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '');
  return configured || new URL(request.url).origin;
}

function workspaceResponse(
  request: Request,
  input: {
    workspace: DeveloperWorkspace | null;
    account: {
      companyName: string;
      slug: string;
      ownerEmail: string | null;
      ownerPhone: string | null;
      brandLogoData: string | null;
    };
    settings: {
      address: string | null;
      city: string | null;
      district: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    } | null;
    activePortfolioCount: number;
  },
) {
  const workspace = input.workspace;
  const temporarySlug = workspace?.temporarySlug || safeSiteSlug(input.account.slug);
  const address = [input.settings?.address, input.settings?.district, input.settings?.city]
    .filter(Boolean)
    .join(', ');

  return {
    success: true,
    website: {
      mode: workspace?.websiteMode || 'UNDECIDED',
      status: workspace?.siteStatus || 'DRAFT',
      brandName: workspace?.brandName || input.account.companyName,
      logoData: workspace?.logoData || input.account.brandLogoData || '',
      primaryColor: workspace?.primaryColor || '#0f766e',
      accentColor: workspace?.accentColor || '#14b8a6',
      contactEmail:
        workspace?.contactEmail || input.settings?.contactEmail || input.account.ownerEmail || '',
      contactPhone:
        workspace?.contactPhone || input.settings?.contactPhone || input.account.ownerPhone || '',
      whatsappPhone: workspace?.whatsappPhone || input.account.ownerPhone || '',
      address: workspace?.address || address,
      temporarySlug,
      temporaryUrl: `${appOrigin(request)}/site/${temporarySlug}`,
      customHostname: workspace?.customHostname || '',
      cnameTarget: workspace?.cnameTarget || cnameTarget,
      domainStatus: workspace?.domainStatus || 'NOT_CONFIGURED',
      sslStatus: workspace?.sslStatus || 'NOT_CONFIGURED',
      lastDomainCheckAt: workspace?.lastDomainCheckAt?.toISOString() || null,
      publishedAt: workspace?.publishedAt?.toISOString() || null,
      activePortfolioCount: input.activePortfolioCount,
    },
    socialAccounts: parseSocialAccounts(workspace?.socialAccounts),
  };
}

async function readWorkspaceData(companyAccountId: string) {
  const [account, settings, workspace, activePortfolioCount] = await Promise.all([
    prisma.companyAccount.findUniqueOrThrow({
      where: { id: companyAccountId },
      select: {
        companyName: true,
        slug: true,
        ownerEmail: true,
        ownerPhone: true,
        brandLogoData: true,
      },
    }),
    prisma.companySettings.findUnique({
      where: { companyAccountId },
      select: {
        address: true,
        city: true,
        district: true,
        contactEmail: true,
        contactPhone: true,
      },
    }),
    prisma.developerWorkspace.findUnique({ where: { companyAccountId } }),
    prisma.crmProperty.count({
      where: publicationEligibilityWhere(companyAccountId, new Date()),
    }),
  ]);
  return { account, settings, workspace, activePortfolioCount };
}

function vercelApiConfig() {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_ORG_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId };
}

async function addDomainToVercel(hostname: string) {
  const config = vercelApiConfig();
  if (!config) return { available: false, verified: false };
  const query = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : '';
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(config.projectId)}/domains${query}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: hostname }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    },
  );
  const body = (await response.json().catch(() => null)) as
    | { verified?: boolean; error?: { code?: string; message?: string } }
    | null;
  if (!response.ok && body?.error?.code !== 'domain_already_in_use') {
    return { available: true, verified: false };
  }
  return { available: true, verified: Boolean(body?.verified) };
}

async function inspectDomainOnVercel(hostname: string) {
  const config = vercelApiConfig();
  if (!config) return { available: false, verified: false };
  const query = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : '';
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(hostname)}${query}`,
    {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    },
  );
  const body = (await response.json().catch(() => null)) as { verified?: boolean } | null;
  return { available: true, verified: response.ok && Boolean(body?.verified) };
}

async function checkDomain(workspace: DeveloperWorkspace) {
  if (!workspace.customHostname) {
    throw new Error('Önce kullanmak istediğiniz alan adını kaydedin.');
  }

  await addDomainToVercel(workspace.customHostname).catch(() => null);
  const [vercel, cnameRecords] = await Promise.all([
    inspectDomainOnVercel(workspace.customHostname).catch(() => ({
      available: false,
      verified: false,
    })),
    resolveCname(workspace.customHostname).catch(() => [] as string[]),
  ]);

  const normalizedRecords = cnameRecords.map((record) =>
    record.toLocaleLowerCase('en-US').replace(/\.$/, ''),
  );
  const cnameVerified = normalizedRecords.some(
    (record) =>
      record === workspace.cnameTarget ||
      record.endsWith('.vercel-dns.com') ||
      /\.vercel-dns-\d+\.com$/.test(record),
  );

  let sslActive = false;
  if (cnameVerified || vercel.verified) {
    sslActive = await fetch(`https://${workspace.customHostname}`, {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    })
      .then(() => true)
      .catch(() => false);
  }

  const domainStatus =
    vercel.verified || (cnameVerified && sslActive)
      ? 'VERIFIED'
      : cnameVerified
        ? 'DNS_VERIFIED'
        : 'WAITING_DNS';
  const sslStatus = sslActive ? 'ACTIVE' : cnameVerified ? 'PROVISIONING' : 'WAITING_DNS';
  return { domainStatus, sslStatus };
}

function errorResponse(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ success: false, error: 'Oturum gerekli.' }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: 'Bu alanı yalnızca şirket patronu düzenleyebilir.' },
      { status: 403 },
    );
  }
  const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    return NextResponse.json(
      workspaceResponse(request, await readWorkspaceData(principal.account.id)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = developerWorkspaceRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Bilgileri kontrol edin.' },
        { status: 400 },
      );
    }

    const accountId = principal.account.id;
    const input = parsed.data;
    if (input.action === 'save-website') {
      const customHostname =
        input.mode === 'EXISTING' ? buildPortfolioHostname(input.baseDomain) : null;
      const current = await prisma.developerWorkspace.findUnique({
        where: { companyAccountId: accountId },
        select: { customHostname: true },
      });
      const hostnameChanged = current?.customHostname !== customHostname;
      const sharedData = {
        websiteMode: input.mode,
        brandName: input.brandName,
        logoData: input.logoData || null,
        primaryColor: input.primaryColor.toLocaleLowerCase('en-US'),
        accentColor: input.accentColor.toLocaleLowerCase('en-US'),
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        whatsappPhone: input.whatsappPhone || null,
        address: input.address || null,
        customHostname,
        cnameTarget,
        ...(hostnameChanged
          ? {
              domainStatus: customHostname ? 'WAITING_DNS' : 'NOT_CONFIGURED',
              sslStatus: customHostname ? 'WAITING_DNS' : 'NOT_CONFIGURED',
              lastDomainCheckAt: null,
            }
          : {}),
      } satisfies Prisma.DeveloperWorkspaceUpdateInput;

      await prisma.developerWorkspace.upsert({
        where: { companyAccountId: accountId },
        create: {
          companyAccountId: accountId,
          temporarySlug: safeSiteSlug(principal.account.slug),
          socialAccounts: [],
          siteStatus: 'DRAFT',
          ...sharedData,
        },
        update: sharedData,
      });

      if (customHostname) {
        await addDomainToVercel(customHostname).catch(() => null);
      }
    }

    if (input.action === 'publish-site') {
      const workspace = await prisma.developerWorkspace.findUnique({
        where: { companyAccountId: accountId },
      });
      if (!workspace) throw new Error('Önce site bilgilerinizi kaydedin.');
      await prisma.developerWorkspace.update({
        where: { companyAccountId: accountId },
        data: { siteStatus: 'PUBLISHED', publishedAt: workspace.publishedAt || new Date() },
      });
    }

    if (input.action === 'check-domain') {
      const workspace = await prisma.developerWorkspace.findUnique({
        where: { companyAccountId: accountId },
      });
      if (!workspace) throw new Error('Önce site bilgilerinizi kaydedin.');
      const status = await checkDomain(workspace);
      await prisma.developerWorkspace.update({
        where: { companyAccountId: accountId },
        data: { ...status, lastDomainCheckAt: new Date() },
      });
    }

    if (input.action === 'save-social-account') {
      const workspace = await prisma.developerWorkspace.findUnique({
        where: { companyAccountId: accountId },
      });
      const socialAccounts = upsertSocialAccount(
        parseSocialAccounts(workspace?.socialAccounts),
        input.account,
      );
      await prisma.developerWorkspace.upsert({
        where: { companyAccountId: accountId },
        create: {
          companyAccountId: accountId,
          temporarySlug: safeSiteSlug(principal.account.slug),
          brandName: principal.account.companyName,
          logoData: principal.account.brandLogoData,
          socialAccounts,
        },
        update: { socialAccounts },
      });
    }

    return NextResponse.json(
      workspaceResponse(request, await readWorkspaceData(accountId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

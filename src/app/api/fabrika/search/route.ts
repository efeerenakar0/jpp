import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  normalizeFabrikaSearchQuery,
  normalizeSearchPhone,
  safeSearchLimit,
} from '@/lib/fabrika-search';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.string().trim().min(2).max(120);

type SearchResult = {
  id: string;
  category: string;
  label: string;
  description: string;
  href: string;
};

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(
      normalizeFabrikaSearchQuery(url.searchParams.get('q') || '')
    );
    if (!parsed.success) {
      return NextResponse.json({ success: true, results: [] });
    }

    const q = parsed.data;
    const phone = normalizeSearchPhone(q);
    const take = safeSearchLimit(url.searchParams.get('limit'));
    const companyAccountId = principal.account.id;
    const text = { contains: q, mode: 'insensitive' as const };

    const [contacts, properties, tasks, documents, campaigns, members, sites] =
      await Promise.all([
        prisma.crmContact.findMany({
          where: {
            companyAccountId,
            OR: [
              { name: text },
              { email: text },
              { phone: text },
              ...(phone ? [{ phoneNormalized: { contains: phone } }] : []),
            ],
          },
          select: { id: true, name: true, phone: true, email: true },
          orderBy: { updatedAt: 'desc' },
          take,
        }),
        prisma.crmProperty.findMany({
          where: {
            companyAccountId,
            OR: [
              { title: text },
              { location: text },
              { referenceCode: text },
              { description: text },
            ],
          },
          select: { id: true, title: true, location: true, status: true },
          orderBy: { updatedAt: 'desc' },
          take,
        }),
        prisma.crmTask.findMany({
          where: {
            companyAccountId,
            OR: [{ title: text }, { description: text }],
          },
          select: { id: true, title: true, type: true, dueAt: true },
          orderBy: { updatedAt: 'desc' },
          take,
        }),
        prisma.companyDocument.findMany({
          where: {
            companyAccountId,
            deletedAt: null,
            OR: [{ title: text }, { documentNumber: text }],
          },
          select: { id: true, title: true, documentNumber: true, status: true },
          orderBy: { updatedAt: 'desc' },
          take,
        }),
        prisma.adCampaign.findMany({
          where: {
            companyAccountId,
            OR: [{ name: text }, { description: text }],
          },
          select: { id: true, name: true, status: true, type: true },
          orderBy: { createdAt: 'desc' },
          take,
        }),
        prisma.companyMember.findMany({
          where: {
            companyAccountId,
            active: true,
            OR: [
              { name: text },
              { email: text },
              { phone: text },
              ...(phone ? [{ phoneNormalized: { contains: phone } }] : []),
            ],
          },
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
          take,
        }),
        principal.permissions.canManageSecrets
          ? prisma.websiteIntegration.findMany({
              where: {
                companyAccountId,
                OR: [
                  { displayName: text },
                  { websiteUrl: text },
                  { hostingProvider: text },
                ],
              },
              select: {
                id: true,
                displayName: true,
                websiteUrl: true,
                status: true,
              },
              orderBy: { updatedAt: 'desc' },
              take,
            })
          : Promise.resolve([]),
      ]);

    const results: SearchResult[] = [
      ...contacts.map((item) => ({
        id: item.id,
        category: 'Müşteriler',
        label: item.name,
        description: item.phone || item.email || 'CRM müşterisi',
        href: `/fabrika/crm?contactId=${encodeURIComponent(item.id)}`,
      })),
      ...properties.map((item) => ({
        id: item.id,
        category: 'Portföyler',
        label: item.title,
        description: `${item.location || 'Konum belirtilmedi'} · ${item.status}`,
        href: `/fabrika/portfoyler?propertyId=${encodeURIComponent(item.id)}`,
      })),
      ...tasks.map((item) => ({
        id: item.id,
        category: 'Görevler ve randevular',
        label: item.title,
        description: `${item.type}${
          item.dueAt
            ? ` · ${item.dueAt.toLocaleDateString('tr-TR')}`
            : ''
        }`,
        href: `/fabrika/takvim?taskId=${encodeURIComponent(item.id)}`,
      })),
      ...documents.map((item) => ({
        id: item.id,
        category: 'Belgeler',
        label: item.title,
        description: `${item.documentNumber} · ${item.status}`,
        href: `/fabrika/belgeler?documentId=${encodeURIComponent(item.id)}`,
      })),
      ...campaigns.map((item) => ({
        id: item.id,
        category: 'Kampanyalar',
        label: item.name,
        description: `${item.type} · ${item.status}`,
        href: `/fabrika/pazarlamaci?campaignId=${encodeURIComponent(item.id)}`,
      })),
      ...members.map((item) => ({
        id: item.id,
        category: 'Ekip',
        label: item.name,
        description: item.role === 'OWNER' ? 'Patron' : 'Çalışan',
        href: `/fabrika/sirket?memberId=${encodeURIComponent(item.id)}`,
      })),
      ...sites.map((item) => ({
        id: item.id,
        category: 'Web sitesi projeleri',
        label: item.displayName,
        description: `${item.websiteUrl} · ${item.status}`,
        href: `/fabrika/yazilimci?siteId=${encodeURIComponent(item.id)}`,
      })),
    ];

    return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Fabrika search error:', error);
    return NextResponse.json(
      { success: false, error: 'Arama şu anda tamamlanamadı.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { PARTNER_COUNTRIES } from '@/lib/partner-outreach/countries';
import { partnerApiError } from '@/lib/partner-outreach/api';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const policies = await prisma.partnerCountryPolicy.findMany({ where: { companyAccountId: principal.account.id } });
    const byCountry = new Map(policies.map((policy) => [policy.countryCode, policy]));
    return NextResponse.json({ success: true, countries: PARTNER_COUNTRIES.map(([code, name, language]) => ({
      code, name, language, policy: byCountry.get(code)?.status || 'BLOCKED_PENDING_COUNTRY_REVIEW',
    })) });
  } catch (error) { return partnerApiError(error); }
}

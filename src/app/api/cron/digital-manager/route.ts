import { NextResponse } from 'next/server';

import { recoverStaleManagerActions } from '@/lib/digital-manager/action-recovery';
import {
  generateActiveCompanyDailySummaries,
  processDueOperationalCommitments,
} from '@/lib/digital-manager/commitment-monitor';
import { recoverStaleInboundCustomerMessages } from '@/lib/whatsapp-incoming';
import { processDueViewingAcknowledgements } from '@/lib/viewing-workflow/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get('authorization') !== `Bearer ${secret}`
  ) {
    return NextResponse.json(
      { error: 'Yetkisiz cron isteği.' },
      { status: 401 }
    );
  }
  try {
    const now = new Date();
    const [
      commitments,
      summaries,
      recoveredActions,
      recoveredInboundMessages,
      viewingAcknowledgements,
    ] = await Promise.all([
      processDueOperationalCommitments(now),
      generateActiveCompanyDailySummaries(now),
      recoverStaleManagerActions(now),
      recoverStaleInboundCustomerMessages(now),
      processDueViewingAcknowledgements(now),
    ]);
    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      commitmentActions: commitments.length,
      summaries: summaries.length,
      recoveredActions: recoveredActions.length,
      recoveredInboundMessages: recoveredInboundMessages.length,
      viewingAcknowledgements: viewingAcknowledgements.length,
      commitments,
      actionRecoveries: recoveredActions,
      inboundRecoveries: recoveredInboundMessages,
      viewingAcknowledgementActions: viewingAcknowledgements,
    });
  } catch (error) {
    console.error('[Digital Manager Cron Error]:', error);
    return NextResponse.json(
      { error: 'Dijital Genel Müdür zamanlanmış işlemleri tamamlanamadı.' },
      { status: 500 }
    );
  }
}

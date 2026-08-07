import { describe, expect, it } from 'vitest';

import {
  buildSalesConversationRows,
  buildSalesSummary,
  type SalesConversation,
} from './sales-data';

const conversations: SalesConversation[] = [
  {
    id: 'new-message',
    customerName: 'Ayşe Kaya',
    customerPhone: '+905551112233',
    intent: 'RESIDENTIAL',
    summary: 'Kadıköy’deki daireyi görmek istiyor.',
    updatedAt: '2026-08-05T12:00:00.000Z',
    messages: [
      {
        id: 'message-new',
        role: 'customer',
        content: 'Bugün görebilir miyim?',
        createdAt: '2026-08-05T12:00:00.000Z',
        readAt: null,
      },
    ],
  },
  {
    id: 'appointment',
    customerName: 'Mehmet Demir',
    customerPhone: '+905554445566',
    intent: 'INVESTMENT',
    summary: 'Yatırımlık portföy arıyor.',
    updatedAt: '2026-08-05T11:30:00.000Z',
    messages: [
      {
        id: 'message-appointment',
        role: 'assistant',
        content: 'Randevunuzu planlıyorum.',
        createdAt: '2026-08-05T11:30:00.000Z',
        readAt: null,
      },
    ],
  },
];

describe('Business CEO sales expert data', () => {
  it('derives row states only from persisted conversation and appointment data', () => {
    const rows = buildSalesConversationRows(conversations, [
      {
        id: 'appointment-1',
        conversationId: 'appointment',
        status: 'PENDING',
      },
    ]);

    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ['new-message', 'NEW'],
      ['appointment', 'APPOINTMENT'],
    ]);
    expect(rows[0]?.preview).toBe('Bugün görebilir miyim?');
  });

  it('builds dashboard counts without inventing placeholder values', () => {
    const rows = buildSalesConversationRows(conversations, []);
    const summary = buildSalesSummary(rows, {
      activeConversations: 2,
      handoffConversations: 1,
      todayMessages: 4,
      incomingMessages: 2,
      outgoingMessages: 2,
      deliveredMessages: 1,
      failedMessages: 0,
      pendingAppointments: 3,
      approvedToday: 0,
    });

    expect(summary).toEqual({
      newMessages: 1,
      waitingForReply: 1,
      appointments: 3,
    });
  });

  it('returns unknown metrics when the metrics endpoint is unavailable', () => {
    const rows = buildSalesConversationRows([], []);
    expect(buildSalesSummary(rows, null)).toEqual({
      newMessages: 0,
      waitingForReply: 0,
      appointments: null,
    });
  });
});

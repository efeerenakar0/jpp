import {
  deriveSalesConversationStatus,
  latestConversationMessage,
  type SalesConversationStatus,
} from '@/lib/business-ceo-dashboard';

export type SalesMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  deliveryStatus?: string;
  messageType?: string;
  deliveredAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
};

export type SalesConversation = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  channel?: string;
  intent: string;
  summary: string | null;
  notes?: string | null;
  tags?: string[];
  aiEnabled?: boolean;
  lastCustomerMessageAt?: string | null;
  updatedAt: string;
  messages: SalesMessage[];
  _count?: { messages: number };
};

export type SalesAppointment = {
  id: string;
  conversationId: string;
  status: string;
};

export type AssistantMetrics = {
  totalConversations?: number;
  activeConversations: number;
  handoffConversations: number;
  todayMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  deliveredMessages: number;
  failedMessages: number;
  pendingAppointments: number;
  approvedToday: number;
};

export type WhatsAppStatus = {
  provider: 'WAHA';
  configured: boolean;
  connectionStatus: string;
  connectedPhone: string | null;
  connectedProfileName: string | null;
  lastConnectedAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  platformEnabled: boolean;
  autoReplyEnabled: boolean;
  allowFirstContact: boolean;
  dailyMessageLimit: number;
};

export type SalesConversationRow = SalesConversation & {
  latestMessage: SalesMessage | null;
  preview: string;
  status: SalesConversationStatus;
  activityAt: string;
};

const activeAppointmentStatuses = new Set([
  'PENDING',
  'APPROVED',
  'CONFIRMED',
]);

export function buildSalesConversationRows(
  conversations: readonly SalesConversation[],
  appointments: readonly SalesAppointment[]
): SalesConversationRow[] {
  const appointmentStatuses = new Map<string, string[]>();
  for (const appointment of appointments) {
    if (!activeAppointmentStatuses.has(appointment.status)) continue;
    appointmentStatuses.set(appointment.conversationId, [
      ...(appointmentStatuses.get(appointment.conversationId) || []),
      appointment.status,
    ]);
  }

  return conversations
    .map((conversation) => {
      const latestMessage = latestConversationMessage(conversation.messages);
      const baseStatus = deriveSalesConversationStatus({
        latestRole: latestMessage?.role || null,
        messageCount:
          conversation._count?.messages ?? conversation.messages.length,
        appointmentStatuses:
          appointmentStatuses.get(conversation.id) || [],
      });
      const status =
        baseStatus === 'WAITING' && !latestMessage?.readAt
          ? 'NEW'
          : baseStatus;

      return {
        ...conversation,
        latestMessage,
        preview:
          latestMessage?.content.trim() ||
          conversation.summary?.trim() ||
          'Henüz mesaj yok.',
        status,
        activityAt: latestMessage?.createdAt || conversation.updatedAt,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.activityAt).getTime() -
        new Date(left.activityAt).getTime()
    );
}

export function buildSalesSummary(
  rows: readonly SalesConversationRow[],
  metrics: AssistantMetrics | null
) {
  return {
    newMessages: rows.filter((row) => row.status === 'NEW').length,
    waitingForReply: rows.filter(
      (row) => row.status === 'NEW' || row.status === 'WAITING'
    ).length,
    appointments: metrics?.pendingAppointments ?? null,
  };
}

export function customerInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

  return initials || 'M';
}

export function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

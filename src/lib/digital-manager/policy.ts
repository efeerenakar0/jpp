export type ManagerAutonomyMode =
  | 'SUGGEST_ONLY'
  | 'APPROVAL_REQUIRED'
  | 'AUTO_LOW_RISK';

export type ManagerPolicySettings = {
  autonomyMode: ManagerAutonomyMode;
  allowAutomaticEmployeeAssignment: boolean;
  allowAutomaticEmployeeWhatsApp: boolean;
  notifyCriticalImmediately: boolean;
  notifyTaskAccepted: boolean;
  notifyOnlyProblemsAndDelays: boolean;
  alwaysNotifyHotLeads: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
};

export type ManagerActionType =
  | 'CREATE_TASK'
  | 'ASSIGN_EMPLOYEE'
  | 'REASSIGN_EMPLOYEE'
  | 'UPDATE_TASK_STATUS'
  | 'CREATE_COMMITMENT'
  | 'CREATE_CRM_ACTIVITY'
  | 'UPDATE_LEAD_STAGE'
  | 'SEND_EMPLOYEE_WHATSAPP'
  | 'NOTIFY_OWNER'
  | 'OFFER_CONVERSATION_HANDOFF'
  | 'SCHEDULE_APPOINTMENT'
  | 'ASK_CLARIFICATION'
  | 'CREATE_POLICY'
  | 'NO_ACTION';

export function evaluateActionPolicy(
  action: {
    actionType: ManagerActionType;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    statusProposal?: string | null;
    containsBindingCommitment?: boolean;
    hasAutomaticAssignment?: boolean;
  },
  settings: ManagerPolicySettings
) {
  if (action.actionType === 'NO_ACTION') {
    return {
      decision: 'NO_ACTION' as const,
      requiresApproval: false,
      reason: 'İşlem önerilmedi.',
    };
  }
  if (
    action.containsBindingCommitment ||
    action.riskLevel === 'CRITICAL' ||
    action.actionType === 'SCHEDULE_APPOINTMENT' ||
    action.actionType === 'OFFER_CONVERSATION_HANDOFF' ||
    action.actionType === 'CREATE_POLICY'
  ) {
    return {
      decision: 'REQUIRE_APPROVAL' as const,
      requiresApproval: true,
      reason: 'Bağlayıcı veya yüksek riskli işlem insan onayı gerektirir.',
    };
  }
  if (settings.autonomyMode === 'SUGGEST_ONLY') {
    return {
      decision: 'SUGGEST' as const,
      requiresApproval: true,
      reason: 'Şirket yalnız öneri modunda; hiçbir değişiklik otomatik uygulanmaz.',
    };
  }
  const safeInternalAction =
    (action.actionType === 'CREATE_TASK' &&
      (!action.hasAutomaticAssignment ||
        settings.allowAutomaticEmployeeAssignment)) ||
    action.actionType === 'CREATE_CRM_ACTIVITY' ||
    action.actionType === 'CREATE_COMMITMENT' ||
    action.actionType === 'UPDATE_LEAD_STAGE' ||
    action.actionType === 'NOTIFY_OWNER' ||
    action.actionType === 'ASK_CLARIFICATION' ||
    (action.actionType === 'UPDATE_TASK_STATUS' &&
      ['ACCEPTED', 'IN_PROGRESS', 'WAITING_CUSTOMER'].includes(
        action.statusProposal || ''
      ));
  if (safeInternalAction) {
    return {
      decision: 'AUTO_EXECUTE' as const,
      requiresApproval: false,
      reason: 'Doğrulanmış düşük riskli dahili işlem.',
    };
  }
  if (
    action.actionType === 'SEND_EMPLOYEE_WHATSAPP' &&
    !settings.allowAutomaticEmployeeWhatsApp
  ) {
    return {
      decision: 'REQUIRE_APPROVAL' as const,
      requiresApproval: true,
      reason: 'Otomatik çalışan WhatsApp mesajı kapalı.',
    };
  }
  if (
    ['ASSIGN_EMPLOYEE', 'REASSIGN_EMPLOYEE'].includes(action.actionType) &&
    !settings.allowAutomaticEmployeeAssignment
  ) {
    return {
      decision: 'REQUIRE_APPROVAL' as const,
      requiresApproval: true,
      reason: 'Otomatik görev atama kapalı.',
    };
  }
  if (
    settings.autonomyMode === 'AUTO_LOW_RISK' &&
    action.riskLevel === 'LOW'
  ) {
    return {
      decision: 'AUTO_EXECUTE' as const,
      requiresApproval: false,
      reason: 'Şirket düşük riskli otomasyona izin veriyor.',
    };
  }
  return {
    decision: 'REQUIRE_APPROVAL' as const,
    requiresApproval: true,
    reason: 'İşlem şirket politikasına göre onay bekliyor.',
  };
}

export function deliveryPresentation(status: string) {
  const presentations: Record<
    string,
    { label: string; terminal: boolean; successful: boolean }
  > = {
    QUEUED: {
      label: 'Kuyruğa alındı',
      terminal: false,
      successful: false,
    },
    SENDING: {
      label: 'Sağlayıcıya iletiliyor',
      terminal: false,
      successful: false,
    },
    SENT: {
      label: 'Sağlayıcıya iletildi',
      terminal: false,
      successful: true,
    },
    DELIVERED: {
      label: 'Teslim edildi',
      terminal: true,
      successful: true,
    },
    READ: {
      label: 'Okundu',
      terminal: true,
      successful: true,
    },
    RECEIVED: {
      label: 'Yanıt alındı',
      terminal: true,
      successful: true,
    },
    FAILED: {
      label: 'Teslim edilemedi',
      terminal: true,
      successful: false,
    },
  };
  return (
    presentations[status] || {
      label: 'Durum doğrulanamadı',
      terminal: false,
      successful: false,
    }
  );
}

function localMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value || 0
  );
  return hour * 60 + minute;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function isQuietHour(
  now: Date,
  settings: Pick<
    ManagerPolicySettings,
    'timezone' | 'quietHoursStart' | 'quietHoursEnd'
  >
) {
  const minute = localMinutes(now, settings.timezone);
  const start = clockMinutes(settings.quietHoursStart);
  const end = clockMinutes(settings.quietHoursEnd);
  return start <= end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

export function shouldNotifyOwnerNow(
  notification: {
    importance: 'NORMAL' | 'IMPORTANT' | 'CRITICAL';
    eventType: string;
  },
  settings: ManagerPolicySettings,
  now = new Date()
) {
  if (
    notification.eventType === 'MESSAGE_DELIVERY_FAILED' &&
    settings.notifyCriticalImmediately
  ) {
    return true;
  }
  if (
    notification.importance === 'CRITICAL' &&
    settings.notifyCriticalImmediately
  ) {
    return true;
  }
  if (
    notification.eventType === 'HOT_LEAD_DETECTED' &&
    settings.alwaysNotifyHotLeads
  ) {
    return true;
  }
  if (
    settings.quietHoursEnabled &&
    isQuietHour(now, settings)
  ) {
    return false;
  }
  if (notification.eventType === 'MANAGER_SUMMARY') {
    return true;
  }
  if (
    settings.notifyOnlyProblemsAndDelays &&
    ![
      'COMMITMENT_OVERDUE',
      'TASK_REJECTED',
      'MESSAGE_DELIVERY_FAILED',
      'REASSIGNMENT_REQUIRED',
    ].includes(notification.eventType)
  ) {
    return (
      notification.eventType === 'TASK_ACCEPTED' &&
      settings.notifyTaskAccepted
    );
  }
  return true;
}

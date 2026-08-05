export type ViewingReplyActor = 'EMPLOYEE' | 'OWNER';

export type ViewingReplyReceipt = {
  kind: 'CONFIRMED' | 'CLARIFICATION' | 'NO_CHANGE';
  text: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function openPromptCodes(result: Record<string, unknown>) {
  if (!Array.isArray(result.openPrompts)) return '';
  const codes = result.openPrompts
    .map((item) => record(item).shortCode)
    .filter((code): code is string => typeof code === 'string' && code.length > 0)
    .map((code) => `#${code}`);
  return codes.length > 0 ? `: ${codes.join(', ')}` : '.';
}

export function buildViewingReplyReceipt(
  value: unknown,
  actor: ViewingReplyActor
): ViewingReplyReceipt {
  const result = record(value);
  if (result.clarificationRequired === true) {
    return {
      kind: 'CLARIFICATION',
      text:
        actor === 'EMPLOYEE'
          ? `Yanıtı tek bir açık işe bağlayamadım. Lütfen iş koduyla yanıtla${openPromptCodes(result)}`
          : `Yanıtı tek bir açık karara bağlayamadım. Lütfen iş koduyla yanıtlayın${openPromptCodes(result)}`,
    };
  }
  if (result.invalidDate === true) {
    return {
      kind: 'CLARIFICATION',
      text:
        'Randevu tarih ve saati anlayamadım; hiçbir kayıt değiştirilmedi. Lütfen “#İŞKODU RANDEVU 05.08.2026 14:30” biçiminde tekrar yazın.',
    };
  }
  if (result.stale === true) {
    return {
      kind: 'NO_CHANGE',
      text:
        'Bu iş artık açık değil veya ilişkili kayıt değişmiş; bu nedenle hiçbir kayıt değiştirilmedi. Lütfen güncel açık iş kodunu kontrol edin.',
    };
  }
  if (result.mutated === true) {
    return {
      kind: 'CONFIRMED',
      text:
        actor === 'EMPLOYEE'
          ? 'Operasyon yanıtınız doğrulandı ve ilgili işe kaydedildi.'
          : 'Kararınız doğrulandı ve ilgili operasyona uygulandı.',
    };
  }
  return {
    kind: 'NO_CHANGE',
    text:
      'Yanıt alındı ancak doğrulanmış bir durum değişikliği oluşmadı; hiçbir kayıt değiştirilmedi. Lütfen güncel iş koduyla tekrar deneyin.',
  };
}

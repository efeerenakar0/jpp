export type BusinessCeoModuleKey =
  | 'portfolio-specialist'
  | 'studio'
  | 'advertising-design'
  | 'marketing-specialist'
  | 'developer'
  | 'partner-finder'
  | 'authorized-pool'
  | 'deed-tracking'
  | 'company-ceo';

export type BusinessCeoModuleDefinition = {
  key: BusinessCeoModuleKey;
  step?: number;
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  actionLabel: string;
  accent: 'cyan' | 'violet' | 'blue';
};

export const BUSINESS_CEO_MODULES: {
  workflow: readonly BusinessCeoModuleDefinition[];
  secondary: readonly BusinessCeoModuleDefinition[];
} = {
  workflow: [
    {
      key: 'portfolio-specialist',
      step: 1,
      title: 'AI Portföy Uzmanı',
      shortTitle: 'Portföy Uzmanı',
      description: 'Portföylerinizi yönetin veya yeni portföy fırsatları keşfedin.',
      href: '/fabrika/avci',
      actionLabel: 'Portföyleri aç',
      accent: 'cyan',
    },
    {
      key: 'studio',
      step: 2,
      title: 'AI Stüdyo',
      shortTitle: 'Stüdyo',
      description: 'Görsellerinizi iyileştirin, düzenleyin ve yayın için hazırlayın.',
      href: '/fabrika/studyo?area=enhancer',
      actionLabel: 'Stüdyoyu aç',
      accent: 'violet',
    },
    {
      key: 'advertising-design',
      step: 3,
      title: 'AI Reklam Tasarımı',
      shortTitle: 'Reklam Tasarımı',
      description: 'Portföyleriniz için poster ve video çalışmaları oluşturun.',
      href: '/fabrika/reklam-tasarimi',
      actionLabel: 'Tasarım oluştur',
      accent: 'violet',
    },
    {
      key: 'marketing-specialist',
      step: 4,
      title: 'AI Pazarlama Uzmanı',
      shortTitle: 'Pazarlama Uzmanı',
      description: 'Portföylerinizi doğru kanallarda doğru kitlelerle buluşturun.',
      href: '/fabrika/pazarlamaci',
      actionLabel: 'Pazarlamayı aç',
      accent: 'violet',
    },
  ],
  secondary: [
    {
      key: 'developer',
      title: 'AI Yazılımcı',
      shortTitle: 'Yazılımcı',
      description: 'Web sitenizin bağlantı ve entegrasyon durumunu yönetin.',
      href: '/fabrika/yazilimci',
      actionLabel: 'Web sitelerini aç',
      accent: 'blue',
    },
    {
      key: 'partner-finder',
      title: 'AI Partner Bulucu',
      shortTitle: 'Partner Bulucu',
      description: 'Yurt dışındaki güvenilir emlak partnerleriyle iş ortaklığı kurun.',
      href: '/fabrika/partnerler',
      actionLabel: 'Partner ağını aç',
      accent: 'blue',
    },
    {
      key: 'authorized-pool',
      title: 'AI Yetkili Portföy Havuzu',
      shortTitle: 'Yetkili Portföy Havuzu',
      description: 'Paylaşım izni doğrulanmış ortak portföy fırsatlarını inceleyin.',
      href: '/fabrika/yetkili-havuz',
      actionLabel: 'Havuzu aç',
      accent: 'blue',
    },
    {
      key: 'deed-tracking',
      title: 'AI Tapu Takip',
      shortTitle: 'Tapu Takip',
      description: 'Tapu evraklarını ve işlem adımlarını tek yerde takip edin.',
      href: '/fabrika/tapu-takip',
      actionLabel: 'Tapu takibi aç',
      accent: 'blue',
    },
    {
      key: 'company-ceo',
      title: 'AI Şirket CEO',
      shortTitle: 'Şirket CEO',
      description: 'Şirket performansınızı, görevleri ve kritik kararları görün.',
      href: '/fabrika/crm?view=company-ceo',
      actionLabel: 'CEO görünümünü aç',
      accent: 'blue',
    },
  ],
} as const;

export type SalesConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export type SalesConversationStatus = 'NEW' | 'WAITING' | 'APPOINTMENT' | 'ACTIVE';

export function latestConversationMessage<T extends SalesConversationMessage>(
  messages: readonly T[]
) {
  return [...messages].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )[0] ?? null;
}

export function deriveSalesConversationStatus({
  latestRole,
  messageCount,
  appointmentStatuses,
}: {
  latestRole: string | null;
  messageCount: number;
  appointmentStatuses: readonly string[];
}): SalesConversationStatus {
  if (
    appointmentStatuses.some((status) =>
      ['PENDING', 'APPROVED', 'CONFIRMED'].includes(status)
    )
  ) {
    return 'APPOINTMENT';
  }
  if (messageCount === 0) return 'NEW';
  if (latestRole === 'customer') return 'WAITING';
  return 'ACTIVE';
}

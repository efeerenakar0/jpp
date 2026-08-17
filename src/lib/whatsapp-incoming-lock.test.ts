import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildActiveWhatsAppConversationLockQuery } from './whatsapp-incoming';

describe('active WhatsApp conversation lock', () => {
  it('casts PostgreSQL advisory-lock void output before Prisma reads it', () => {
    const query = buildActiveWhatsAppConversationLockQuery(
      'company-a:905551112233:active-whatsapp-conversation'
    );

    expect(query.strings.join('?')).toContain('pg_advisory_xact_lock');
    expect(query.strings.join('?')).toContain('::text');
    expect(query.values).toContain(
      'company-a:905551112233:active-whatsapp-conversation'
    );
  });
});

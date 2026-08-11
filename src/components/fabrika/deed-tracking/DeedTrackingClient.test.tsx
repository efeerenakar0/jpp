import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DeedTrackingView } from './DeedTrackingClient';
import type { DeedCase } from './types';

const noOp = vi.fn();

const deedCase: DeedCase = {
  id: 'case-1',
  title: 'P-104 satış tapu takibi',
  type: 'SALE',
  status: 'DOCUMENTS_MISSING',
  version: 1,
  checklist: [
    { key: 'identity', label: 'Kimlik belgeleri', required: true, completed: false },
    { key: 'dask', label: 'DASK', required: true, completed: true },
  ],
  appointmentAt: null,
  dueAt: '2026-08-10T12:00:00.000Z',
  notes: null,
  officialIntegration: 'NOT_CONNECTED',
  humanApprovalRequired: true,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
  property: { id: 'property-1', title: 'Oba 3+1', referenceCode: 'P-104' },
  contact: { id: 'contact-1', name: 'Müşteri' },
  assignedMember: { id: 'member-1', name: 'Danışman' },
  events: [],
};

describe('DeedTrackingView', () => {
  it('renders the simplified operations overview with explicit official-system boundaries', () => {
    const html = renderToStaticMarkup(
      <DeedTrackingView cases={[deedCase]} error={null} loading={false} onCreate={noOp} onOpen={noOp} onRefresh={noOp} />
    );

    expect(html).toContain('Tapu işlemleriniz, sade ve kontrol altında');
    expect(html).toContain('Resmî Tapu sistemi bağlantısı yok');
    expect(html).toContain('Hukuki kontrol ve insan onayı gerekir');
    expect(html).toContain('Bugün ne yapmalıyım?');
    expect(html).toContain('Tapu işlemi 6 kolay adımda');
    expect(html).toContain('Güvenli Ödeme: 1 Ekim 2026');
    expect(html).toContain('Yetki dosyasını en az 5 yıl saklayın');
    expect(html).toContain('50 şablondan seçip PDF indirin');
    expect(html).toContain('P-104 satış tapu takibi');
    expect(html).toContain('1 zorunlu evrak bekliyor');
  });

  it('locks refresh while loading and renders an actionable error state', () => {
    const loadingHtml = renderToStaticMarkup(
      <DeedTrackingView cases={[]} error={null} loading onCreate={noOp} onOpen={noOp} onRefresh={noOp} />
    );
    expect(loadingHtml).toContain('Yenile');
    expect(loadingHtml).toContain('disabled=""');

    const errorHtml = renderToStaticMarkup(
      <DeedTrackingView cases={[]} error="Servis kullanılamıyor." loading={false} onCreate={noOp} onOpen={noOp} onRefresh={noOp} />
    );
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('Servis kullanılamıyor.');
    expect(errorHtml).toContain('Yeniden dene');
  });
});

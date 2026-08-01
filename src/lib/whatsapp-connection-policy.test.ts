import { describe, expect, it } from 'vitest';
import {
  parseWhatsAppConnectionAction,
  wahaRecoveryAction,
} from './whatsapp-connection-policy';

describe('WhatsApp connection policy', () => {
  it('requires an explicit confirmation phrase before disconnecting a phone', () => {
    expect(
      parseWhatsAppConnectionAction({
        action: 'disconnect',
      }).success
    ).toBe(false);
    expect(
      parseWhatsAppConnectionAction({
        action: 'disconnect',
        confirmation: 'disconnect',
      }).success
    ).toBe(false);
    expect(
      parseWhatsAppConnectionAction({
        action: 'disconnect',
        confirmation: 'WHATSAPP_BAGLANTISINI_KES',
      }).success
    ).toBe(true);
  });

  it('chooses the safe recovery command for stopped and failed sessions', () => {
    expect(wahaRecoveryAction('FAILED')).toBe('restart');
    expect(wahaRecoveryAction('STOPPED')).toBe('start');
    expect(wahaRecoveryAction('WORKING')).toBe('none');
    expect(wahaRecoveryAction('SCAN_QR_CODE')).toBe('none');
  });
});

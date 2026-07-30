import { describe, expect, it } from 'vitest';
import {
  businessCeoBrand,
  resolveWorkspaceBrand,
} from './business-ceo-brand';

describe('Business CEO AI marka kimliği', () => {
  it('ürün adını bütün panel yüzeyleri için tek kaynaktan sunar', () => {
    expect(businessCeoBrand.productName).toBe('Business CEO AI');
    expect(businessCeoBrand.panelName).toBe('CEO Workspace');
    expect(businessCeoBrand.assistantName).toBe('CEO Copilot');
  });

  it('eski varsayılan marka adlarını yeni ürün adına dönüştürür', () => {
    expect(resolveWorkspaceBrand('Jasmine AI')).toBe('Business CEO AI');
    expect(resolveWorkspaceBrand('Jasmine Group')).toBe('Business CEO AI');
    expect(resolveWorkspaceBrand('')).toBe('Business CEO AI');
  });

  it('müşterinin açıkça tanımladığı şirket adını korur', () => {
    expect(resolveWorkspaceBrand('Akar Group')).toBe('Akar Group');
  });
});

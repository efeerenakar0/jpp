import { describe, expect, it } from 'vitest';
import { cn } from '../../../lib/utils';
import { DOCUMENT_WIZARD_DIALOG_CLASS_NAME } from './layout';

const BASE_DIALOG_WIDTH_CLASSES =
  'w-full max-w-[calc(100%-2rem)] sm:max-w-sm';

describe('document wizard responsive layout', () => {
  it('overrides the shared small dialog width on desktop', () => {
    const merged = cn(
      BASE_DIALOG_WIDTH_CLASSES,
      DOCUMENT_WIZARD_DIALOG_CLASS_NAME
    );

    expect(merged).toContain('sm:max-w-none');
    expect(merged).toContain('2xl:max-w-[1500px]');
    expect(merged).not.toContain('sm:max-w-sm');
  });

  it('keeps the editor inside the mobile and desktop viewport', () => {
    expect(DOCUMENT_WIZARD_DIALOG_CLASS_NAME).toContain(
      'w-[calc(100vw-1rem)]'
    );
    expect(DOCUMENT_WIZARD_DIALOG_CLASS_NAME).toContain(
      'sm:w-[calc(100vw-2rem)]'
    );
    expect(DOCUMENT_WIZARD_DIALOG_CLASS_NAME).toContain(
      'h-[calc(100dvh-1rem)]'
    );
  });
});

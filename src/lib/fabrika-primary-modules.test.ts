import { describe, expect, it } from 'vitest';
import { primaryModuleDefinitions } from './fabrika-primary-modules';

describe('Fabrika ana modül sırası', () => {
  it('Belge Merkezi M6 olarak Stüdyo modülünün hemen altında görünür', () => {
    const studioIndex = primaryModuleDefinitions.findIndex(
      (module) => module.name === 'Stüdyo'
    );
    const documentsIndex = primaryModuleDefinitions.findIndex(
      (module) => module.name === 'Belge Merkezi'
    );

    expect(documentsIndex).toBe(studioIndex + 1);
    expect(primaryModuleDefinitions[documentsIndex]).toMatchObject({
      href: '/fabrika/belgeler',
      description: 'Sözleşme ve belge oluşturma',
      moduleNumber: 6,
    });
  });
});

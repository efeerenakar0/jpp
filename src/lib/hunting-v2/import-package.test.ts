import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import {
  assertSafeZipEntryName,
  HUNTING_IMPORT_MAX_BYTES,
  parseHuntingImportPackage,
} from './import-package';

const listing = {
  listingId: '1297022611',
  title: 'Oba mahallesinde satılık 2+1 daire',
  sourceUrl:
    'https://www.sahibinden.com/ilan/emlak-konut-satilik-ornek-1297022611/detay',
  price: '5.850.000 TL',
  location: 'Antalya / Alanya / Oba Mh.',
};

function zipWith(name: string, payload: unknown) {
  const zip = new AdmZip();
  zip.addFile(name, Buffer.from(JSON.stringify(payload), 'utf8'));
  return zip.toBuffer();
}

describe('Avcı çevrimdışı ilan paketi', () => {
  it('düz JSON listesini kabul eder', () => {
    const result = parseHuntingImportPackage({
      fileName: 'jasmine_ilanlar.json',
      mimeType: 'application/json',
      bytes: Buffer.from(JSON.stringify([listing]), 'utf8'),
    });

    expect(result.listings).toEqual([listing]);
    expect(result.sourceFile).toBe('jasmine_ilanlar.json');
    expect(result.ignoredSensitiveFieldCount).toBe(0);
  });

  it('ZIP içindeki ilan listesini güvenli biçimde okur', () => {
    const result = parseHuntingImportPackage({
      fileName: 'jasmine_portfoy_paketi.zip',
      mimeType: 'application/zip',
      bytes: zipWith('export/jasmine_ilanlar.json', {
        version: 1,
        listings: [listing],
      }),
    });

    expect(result.listings).toEqual([listing]);
    expect(result.sourceFile).toBe('export/jasmine_ilanlar.json');
  });

  it('telefon alanını ilan verisinden çıkarır ve uyarı sayısını döndürür', () => {
    const result = parseHuntingImportPackage({
      fileName: 'eski_avci_ciktisi.zip',
      mimeType: 'application/zip',
      bytes: zipWith('listings.json', [
        {
          ...listing,
          ownerName: 'İlan sahibi',
          ownerPhone: '05000000000',
        },
      ]),
    });

    expect(result.listings[0]).not.toHaveProperty('ownerPhone');
    expect(result.ignoredSensitiveFieldCount).toBe(1);
  });

  it('ilan verisi içermeyen eklenti kurulum ZIP dosyasını açıklayıcı hatayla reddeder', () => {
    const zip = new AdmZip();
    zip.addFile(
      'jasmine-extension/manifest.json',
      Buffer.from(JSON.stringify({ manifest_version: 3 }), 'utf8')
    );

    expect(() =>
      parseHuntingImportPackage({
        fileName: 'jasmine-extension.zip',
        mimeType: 'application/zip',
        bytes: zip.toBuffer(),
      })
    ).toThrow(/kurulum paketi/i);
  });

  it('izin verilen boyutu aşan dosyayı açmadan reddeder', () => {
    expect(() =>
      parseHuntingImportPackage({
        fileName: 'buyuk.json',
        mimeType: 'application/json',
        bytes: new Uint8Array(HUNTING_IMPORT_MAX_BYTES + 1),
      })
    ).toThrow(/10 MB/i);
  });

  it('ZIP yol geçişi içeren girdiyi reddeder', () => {
    expect(() => assertSafeZipEntryName('../listings.json')).toThrow(
      /güvenli değil/i
    );
  });
});

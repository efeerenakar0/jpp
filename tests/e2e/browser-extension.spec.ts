import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import AdmZip from 'adm-zip';

const repositoryRoot = process.cwd();
const extensionDirectory = path.join(repositoryRoot, 'jasmine-extension');
const checkedInArchive = path.join(
  repositoryRoot,
  'public/downloads/business-ceo-ai-extension.zip'
);
const legacyArchive = path.join(
  repositoryRoot,
  'public/downloads/jasmine-extension.zip'
);
const archiveFolder = 'business-ceo-ai-extension';
const fixtureHtml = readFileSync(
  path.join(repositoryRoot, 'tests/fixtures/sahibinden-search.html'),
  'utf8'
);

test.describe('Avcı tarayıcı eklentisi', () => {
  test('kaynak, manifest ve indirilebilir ZIP deterministik olarak aynıdır', () => {
    const temporaryDirectory = mkdtempSync(
      path.join(tmpdir(), 'business-ceo-extension-')
    );
    const generatedArchive = path.join(temporaryDirectory, 'extension.zip');

    try {
      execFileSync(
        process.execPath,
        [
          path.join(repositoryRoot, 'scripts/build-browser-extension.mjs'),
          '--output',
          generatedArchive,
        ],
        { cwd: repositoryRoot, stdio: 'pipe' }
      );

      expect(readFileSync(generatedArchive)).toEqual(
        readFileSync(checkedInArchive)
      );
      expect(readFileSync(legacyArchive)).toEqual(
        readFileSync(checkedInArchive)
      );

      const sourceFiles = readdirSync(extensionDirectory).sort();
      for (const scriptName of sourceFiles.filter((fileName) =>
        fileName.endsWith('.js')
      )) {
        expect(() =>
          execFileSync(
            process.execPath,
            ['--check', path.join(extensionDirectory, scriptName)],
            { cwd: repositoryRoot, stdio: 'pipe' }
          )
        ).not.toThrow();
      }

      const zip = new AdmZip(checkedInArchive);
      const archiveFiles = zip
        .getEntries()
        .filter((entry) => !entry.isDirectory)
        .map((entry) => entry.entryName.replace(`${archiveFolder}/`, ''))
        .sort();
      expect(archiveFiles).toEqual(sourceFiles);

      for (const fileName of sourceFiles) {
        expect(
          zip.readFile(`${archiveFolder}/${fileName}`),
          `${fileName} ZIP içinde kaynakla birebir aynı olmalı`
        ).toEqual(readFileSync(path.join(extensionDirectory, fileName)));
      }

      const manifest = JSON.parse(
        readFileSync(path.join(extensionDirectory, 'manifest.json'), 'utf8')
      ) as {
        manifest_version: number;
        name: string;
        action?: { default_popup?: string };
        host_permissions?: string[];
      };
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toBe('Business CEO AI Avcı');
      expect(manifest.action?.default_popup).toBe('popup.html');
      expect(sourceFiles).toContain(manifest.action?.default_popup);
      expect(manifest.host_permissions).toEqual(
        expect.arrayContaining([
          'https://www.sahibinden.com/*',
          'http://localhost:3000/*',
        ])
      );

      const popupHtml = readFileSync(
        path.join(extensionDirectory, 'popup.html'),
        'utf8'
      );
      expect(popupHtml).toContain('Business CEO AI');
      expect(popupHtml).not.toContain('Jasmine');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('yalnız yerel fixture içindeki görünür ilan satırlarını ayrıştırır', async ({
    page,
  }) => {
    let attemptedExternalRequest = false;
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        requestUrl.hostname === 'www.sahibinden.com' &&
        route.request().resourceType() === 'document'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: fixtureHtml,
        });
        return;
      }
      attemptedExternalRequest = true;
      await route.abort('blockedbyclient');
    });
    await page.addInitScript(() => {
      type Listener = (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void
      ) => boolean;
      const state = globalThis as typeof globalThis & {
        __extensionListener?: Listener;
        chrome?: unknown;
      };
      state.chrome = {
        runtime: {
          onMessage: {
            addListener(listener: Listener) {
              state.__extensionListener = listener;
            },
          },
        },
      };
    });

    await page.goto(
      'https://www.sahibinden.com/satilik/antalya-alanya?local-fixture=1'
    );
    await page.addScriptTag({ path: path.join(extensionDirectory, 'content.js') });

    const response = await page.evaluate(async () => {
      const state = globalThis as typeof globalThis & {
        __extensionListener?: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean;
      };
      return await new Promise<unknown>((resolve, reject) => {
        if (!state.__extensionListener) {
          reject(new Error('Eklenti mesaj dinleyicisi kurulmadı.'));
          return;
        }
        state.__extensionListener(
          { action: 'collect_visible_search' },
          {},
          resolve
        );
      });
    });

    expect(response).toEqual({
      ok: true,
      data: {
        searchUrl:
          'https://www.sahibinden.com/satilik/antalya-alanya?local-fixture=1',
        visibleRows: [
          {
            listingId: '1297022611',
            url: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-yerel-fixture-1297022611/detay',
            title: "Oba'da yerel test dairesi",
            price: '5.850.000 TL',
            location: 'Antalya / Alanya / Oba',
          },
          {
            listingId: '1300000002',
            url: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-yerel-fixture-1300000002/detay',
            title: "Kestel'de yerel test villası",
            price: '12.750.000 TL',
            location: 'Antalya / Alanya / Kestel',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('Fixture Satıcı');
    expect(JSON.stringify(response)).not.toContain('0 (555) 000 00 00');
    expect(attemptedExternalRequest).toBe(false);
  });
});

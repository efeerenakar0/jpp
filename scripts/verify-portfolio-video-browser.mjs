import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const bundle = await build({
  absWorkingDir: projectRoot,
  entryPoints: ['scripts/portfolio-video-browser-entry.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
  alias: { '@': path.join(projectRoot, 'src') },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body><main id="root"></main></body></html>');
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test sunucusu başlatılamadı.');
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  headless: true,
  executablePath: existsSync(systemChrome) ? systemChrome : undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-features=WebCodecs,WebCodecsVideoEncoder',
  ],
});

try {
  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') process.stderr.write(`[browser] ${message.text()}\n`);
  });
  page.on('pageerror', (error) => process.stderr.write(`[browser] ${error.message}\n`));
  await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.runPortfolioVideoBrowserVerification());
  if (!result.canRender || result.blobSize < 1_000 || result.finalProgress < 0.99) {
    throw new Error(`Tarayıcı MP4 doğrulaması başarısız: ${JSON.stringify(result)}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

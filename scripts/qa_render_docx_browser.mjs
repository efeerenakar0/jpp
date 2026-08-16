import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node qa_render_docx_browser.mjs <input.docx> <output-dir>");
}

const inputPath = path.resolve(inputArg);
const outputDir = path.resolve(outputArg);
const previewScript = path.resolve(
  "artifacts/_docxqa_deps/node_modules/docx-preview/dist/docx-preview.min.js",
);
const jsZipScript = path.resolve(
  "artifacts/_docxqa_deps/node_modules/.pnpm/jszip@3.10.1/node_modules/jszip/dist/jszip.min.js",
);

await fs.mkdir(outputDir, { recursive: true });
const base64 = (await fs.readFile(inputPath)).toString("base64");

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});

try {
  const page = await browser.newPage({
    viewport: { width: 1700, height: 2200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 0; background: #d9dde3; }
      #preview { padding: 28px 0; }
      #preview > section.docx { margin: 0 auto 28px !important; box-shadow: 0 5px 22px rgba(0,0,0,.18); }
    </style></head><body><div id="preview"></div></body></html>`);
  await page.addScriptTag({ path: jsZipScript });
  await page.addScriptTag({ path: previewScript });
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    await window.docx.renderAsync(bytes.buffer, document.querySelector("#preview"), null, {
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
    });
  }, base64);
  await page.waitForTimeout(500);

  const pages = page.locator("section.docx");
  const count = await pages.count();
  if (count === 0) throw new Error("docx-preview produced no pages");

  for (let index = 0; index < count; index += 1) {
    await pages.nth(index).screenshot({
      path: path.join(outputDir, `page-${String(index + 1).padStart(2, "0")}.png`),
    });
  }
  console.log(JSON.stringify({ pages: count, outputDir }));
} finally {
  await browser.close();
}

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(repositoryRoot, 'jasmine-extension');
const archiveFolder = 'business-ceo-ai-extension';
const primaryArchive = path.join(
  repositoryRoot,
  'public/downloads/business-ceo-ai-extension.zip'
);
const legacyArchive = path.join(
  repositoryRoot,
  'public/downloads/jasmine-extension.zip'
);
const fixedTimestamp = new Date('2026-01-01T00:00:00.000Z');

function readOutputArgument() {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex === -1) {
    return null;
  }

  const output = process.argv[outputIndex + 1];
  if (!output) {
    throw new Error('--output için bir dosya yolu gerekli.');
  }
  return path.resolve(process.cwd(), output);
}

async function buildExtensionArchive() {
  const requestedOutput = readOutputArgument();
  const fileNames = (await readdir(sourceDirectory)).sort();
  const archive = new JSZip();

  archive.file(`${archiveFolder}/`, null, {
    dir: true,
    date: fixedTimestamp,
    unixPermissions: 0o40755,
  });

  for (const fileName of fileNames) {
    const sourcePath = path.join(sourceDirectory, fileName);
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      throw new Error(`Eklenti kaynağında beklenmeyen öğe: ${fileName}`);
    }

    archive.file(`${archiveFolder}/${fileName}`, await readFile(sourcePath), {
      binary: true,
      date: fixedTimestamp,
      unixPermissions: 0o100644,
      createFolders: false,
    });
  }

  const buffer = await archive.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });

  const outputPaths = requestedOutput
    ? [requestedOutput]
    : [primaryArchive, legacyArchive];

  for (const outputPath of outputPaths) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
    process.stdout.write(`${path.relative(repositoryRoot, outputPath)}\n`);
  }
}

await buildExtensionArchive();

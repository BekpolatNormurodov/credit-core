// Fetch OCR models for local dev/test: `mrz` (MRZ / OCR-B) + `eng` (ID-card printed text). Prod
// bundles both in the image (deploy/Dockerfile.backend); locally they are gitignored, so run:
//   npm run setup:ocr -w @credit-core/backend
// mrz model: BSD-3-Clause, https://github.com/DoubangoTelecom/tesseractMRZ
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.TESSDATA_PATH || join(HERE, '..', 'tessdata');
const MODELS = [
  ['mrz.traineddata', 'https://github.com/DoubangoTelecom/tesseractMRZ/raw/master/tessdata_fast/mrz.traineddata'],
  ['eng.traineddata', 'https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata'],
];

const exists = async (p) => stat(p).then((s) => s.isFile()).catch(() => false);

await mkdir(DIR, { recursive: true });
for (const [name, url] of MODELS) {
  const dest = join(DIR, name);
  if (await exists(dest)) { console.log(`✓ ${name} already present`); continue; }
  console.log(`Downloading ${name} → ${dest}`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`Download failed for ${name}: ${res.status} ${res.statusText}`); process.exit(1); }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${name} done`);
}

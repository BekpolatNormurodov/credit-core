// Fetch the dedicated MRZ (OCR-B) traineddata for local dev/test. Prod bundles it in the image
// (see deploy/Dockerfile.backend); locally the model is gitignored, so run `npm run setup:ocr`.
// Model: BSD-3-Clause, https://github.com/DoubangoTelecom/tesseractMRZ (tessdata_fast/mrz).
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST_DIR = process.env.TESSDATA_PATH || join(HERE, '..', 'tessdata');
const DEST = join(DEST_DIR, 'mrz.traineddata');
const URL = 'https://github.com/DoubangoTelecom/tesseractMRZ/raw/master/tessdata_fast/mrz.traineddata';

const exists = async (p) => stat(p).then((s) => s.isFile()).catch(() => false);

if (await exists(DEST)) {
  console.log(`✓ MRZ model already present: ${DEST}`);
  process.exit(0);
}
console.log(`Downloading MRZ model → ${DEST}`);
const res = await fetch(URL);
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
await mkdir(DEST_DIR, { recursive: true });
await writeFile(DEST, Buffer.from(await res.arrayBuffer()));
console.log('✓ Done.');

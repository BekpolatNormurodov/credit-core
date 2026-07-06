// Opt-in runner for the heavy real-image OCR integration test. Ensures the MRZ model is present,
// then runs just that spec in-band (its native OCR/image work OOMs or starves under jest parallelism).
// Cross-platform: sets the env here rather than relying on shell syntax. Usage: npm run test:ocr
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(HERE, '..');
const JEST = join(BACKEND, '..', '..', 'node_modules', 'jest', 'bin', 'jest.js');

// 1) Make sure the traineddata exists.
let r = spawnSync(process.execPath, [join(HERE, 'fetch-ocr-model.mjs')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

// 2) Run the heavy real-image specs, single-worker, with headroom. --experimental-vm-modules lets
//    the PDF path's dynamic ESM import (pdf-to-img) work inside jest's VM (prod needs no flag).
r = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', '--max-old-space-size=2048', JEST, '--rootDir', 'src', '--runInBand', 'real.spec'],
  { cwd: BACKEND, stdio: 'inherit', env: { ...process.env, RUN_OCR_IT: '1' } },
);
process.exit(r.status ?? 1);

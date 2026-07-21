import { createHash } from 'crypto';

/**
 * The payload the director's key actually signs.
 *
 * Signing 19 PDFs would mean 19 password prompts, which nobody would use. Instead the director
 * signs one small document that *names* all 19 and carries each one's digest. One key press, and
 * the signature still covers every file: change any byte of any document afterwards and its digest
 * no longer matches the manifest the signature is over.
 *
 * Everything a dispute would turn on is inside the signed bytes — which case, which contract
 * number, which organisation, when, and exactly which files. Nothing that matters is left outside.
 */

export interface ManifestDoc {
  /** Registry key, e.g. 'contract'. */
  key: string;
  /** File name as frozen on disk. */
  file: string;
  sha256: string;
  bytes: number;
}

export interface CaseManifest {
  /** Format version. A verifier reading an old signature has to know what shape it is. */
  v: 1;
  caseId: string;
  caseNumber: string;
  contractNumber: string | null;
  org: { name: string; inn: string | null };
  signedAt: string;
  docs: ManifestDoc[];
}

export interface ManifestInput {
  caseId: string;
  caseNumber: string;
  contractNumber?: string | null;
  orgName: string;
  orgInn?: string | null;
  signedAt: Date;
  docs: ManifestDoc[];
}

/**
 * Build the manifest.
 *
 * Documents are sorted by key so the same set always produces the same bytes regardless of the
 * order they happened to be rendered in — the digest has to be reproducible at commit, when the
 * files are re-read from disk.
 */
export function buildManifest(input: ManifestInput): CaseManifest {
  return {
    v: 1,
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    contractNumber: input.contractNumber ?? null,
    org: { name: input.orgName, inn: input.orgInn ?? null },
    signedAt: input.signedAt.toISOString(),
    docs: [...input.docs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

/**
 * The exact bytes that get signed.
 *
 * Written by hand rather than with `JSON.stringify(m)` so the key order is fixed by this function
 * and not by whatever order the object literal happened to be built in. Two runs must produce
 * byte-identical output or the commit-side digest check fails for no real reason.
 */
export function manifestBytes(m: CaseManifest): Buffer {
  const canonical = {
    v: m.v,
    caseId: m.caseId,
    caseNumber: m.caseNumber,
    contractNumber: m.contractNumber,
    org: { name: m.org.name, inn: m.org.inn },
    signedAt: m.signedAt,
    docs: m.docs.map((d) => ({ key: d.key, file: d.file, sha256: d.sha256, bytes: d.bytes })),
  };
  return Buffer.from(JSON.stringify(canonical), 'utf8');
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Digest of the manifest as handed to the client. */
export function manifestSha256(m: CaseManifest): string {
  return sha256(manifestBytes(m));
}

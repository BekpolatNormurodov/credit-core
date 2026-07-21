import { buildManifest, manifestBytes, manifestSha256, sha256, type ManifestDoc } from './manifest';

const doc = (key: string, sha = 'a'.repeat(64), bytes = 1000): ManifestDoc => ({
  key,
  file: `${key}.pdf`,
  sha256: sha,
  bytes,
});

const input = (docs: ManifestDoc[]) => ({
  caseId: 'case-1',
  caseNumber: 'A-100',
  contractNumber: '2110 MFL 1416 PS',
  orgName: 'МЧЖ «CLEVER»',
  orgInn: '301456789',
  signedAt: new Date('2026-07-21T09:00:00.000Z'),
  docs,
});

describe('buildManifest', () => {
  it('sorts documents by key so render order cannot change the bytes', () => {
    const a = buildManifest(input([doc('contract'), doc('act'), doc('prikaz')]));
    const b = buildManifest(input([doc('prikaz'), doc('contract'), doc('act')]));

    expect(a.docs.map((d) => d.key)).toEqual(['act', 'contract', 'prikaz']);
    expect(manifestBytes(a).equals(manifestBytes(b))).toBe(true);
  });

  it('carries the org INN and the contract number into the signed bytes', () => {
    const text = manifestBytes(buildManifest(input([doc('contract')]))).toString('utf8');
    expect(text).toContain('301456789');
    expect(text).toContain('2110 MFL 1416 PS');
    expect(text).toContain('2026-07-21T09:00:00.000Z');
  });

  it('accepts a case with no contract number yet', () => {
    const m = buildManifest({ ...input([doc('contract')]), contractNumber: null });
    expect(m.contractNumber).toBeNull();
    expect(() => manifestBytes(m)).not.toThrow();
  });
});

describe('manifestBytes', () => {
  it('is byte-stable across repeated builds of the same input', () => {
    const once = manifestSha256(buildManifest(input([doc('contract'), doc('act')])));
    const twice = manifestSha256(buildManifest(input([doc('contract'), doc('act')])));
    expect(once).toBe(twice);
  });

  it('changes when any document digest changes — this is what makes the signature cover them', () => {
    const before = manifestSha256(buildManifest(input([doc('contract', 'a'.repeat(64))])));
    const after = manifestSha256(buildManifest(input([doc('contract', 'b'.repeat(64))])));
    expect(after).not.toBe(before);
  });

  it('changes when a document is removed from the set', () => {
    const full = manifestSha256(buildManifest(input([doc('contract'), doc('act')])));
    const partial = manifestSha256(buildManifest(input([doc('contract')])));
    expect(partial).not.toBe(full);
  });

  it('is valid JSON a third party can read back', () => {
    const parsed = JSON.parse(manifestBytes(buildManifest(input([doc('contract')]))).toString('utf8'));
    expect(parsed.v).toBe(1);
    expect(parsed.docs).toHaveLength(1);
    expect(parsed.org.inn).toBe('301456789');
  });
});

describe('sha256', () => {
  it('is the plain hex digest of the bytes', () => {
    // Well-known vector — guards against an encoding or digest-format change.
    expect(sha256(Buffer.from('abc', 'utf8'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

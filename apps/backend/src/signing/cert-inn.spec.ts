import { extractCertInns, signatureCarriesInn } from './cert-inn';

const TIN_OID = [0x06, 0x07, 0x2a, 0x86, 0x5c, 0x03, 0x10, 0x01, 0x01];

/** A fragment shaped like a subject attribute: the TIN OID followed by a DER string. */
function attr(inn: string, tag = 0x13): number[] {
  const bytes = Buffer.from(inn, 'latin1');
  return [...TIN_OID, tag, bytes.length, ...bytes];
}

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');

describe('extractCertInns', () => {
  it('reads a PrintableString INN that follows the TIN OID', () => {
    expect(extractCertInns(b64([0x30, 0x20, ...attr('306365847')]))).toEqual(['306365847']);
  });

  it('reads a UTF8String INN too', () => {
    expect(extractCertInns(b64(attr('306365847', 0x0c)))).toEqual(['306365847']);
  });

  it('finds every INN in the chain — the CA carries its own', () => {
    const der = b64([...attr('306365847'), 0x05, 0x00, ...attr('201122334')]);
    expect(extractCertInns(der).sort()).toEqual(['201122334', '306365847']);
  });

  it('de-duplicates an INN that appears more than once', () => {
    expect(extractCertInns(b64([...attr('306365847'), ...attr('306365847')]))).toEqual(['306365847']);
  });

  it('ignores a value that is not a 9-digit INN', () => {
    // A PINFL (14 digits) sits under a different OID, but must never be read as an INN even if
    // the bytes happen to line up.
    expect(extractCertInns(b64(attr('52101901234567')))).toEqual([]);
    expect(extractCertInns(b64(attr('NOT-AN-INN')))).toEqual([]);
  });

  it('ignores a non-string tag after the OID', () => {
    // 0x02 is INTEGER — the OID matched, but this is not an attribute value we can read.
    expect(extractCertInns(b64([...TIN_OID, 0x02, 0x09, ...Buffer.from('306365847')]))).toEqual([]);
  });

  it('returns nothing rather than throwing on junk input', () => {
    expect(extractCertInns('')).toEqual([]);
    expect(extractCertInns('not base64 at all !!!')).toEqual([]);
    expect(extractCertInns('QUFBQUFB')).toEqual([]);
  });

  it('does not run off the end when the OID is the last thing in the buffer', () => {
    expect(() => extractCertInns(b64(TIN_OID))).not.toThrow();
    expect(extractCertInns(b64(TIN_OID))).toEqual([]);
  });
});

describe('signatureCarriesInn', () => {
  const sig = b64([...attr('306365847'), ...attr('201122334')]);

  it('accepts the firm key', () => {
    expect(signatureCarriesInn(sig, '306365847')).toBe(true);
  });

  it('refuses another INN — a personal or another company key', () => {
    expect(signatureCarriesInn(sig, '999888777')).toBe(false);
  });

  it('tolerates surrounding whitespace in the configured INN', () => {
    expect(signatureCarriesInn(sig, ' 306365847 ')).toBe(true);
  });

  it('refuses when the signature carries no INN at all', () => {
    expect(signatureCarriesInn('QUFBQUFB', '306365847')).toBe(false);
  });
});

/**
 * Pulling the INN (STIR) out of an E-IMZO signature.
 *
 * The requirement is that only the firm's own key may sign — a director's personal key, or another
 * company's, must be refused. The INN is what distinguishes them: an O'zDSt certificate carries it
 * as subject attribute OID `1.2.860.3.16.1.1` (a personal key carries the individual's INN and a
 * PINFL under `…1.2` instead).
 *
 * WHAT THIS IS AND IS NOT
 *
 * This reads the certificate embedded in the PKCS#7. It does not verify the signature — that needs
 * E-IMZO-SERVER and a NIC contract we do not have. So a determined forger could staple our own
 * certificate onto a bogus signature and pass this check.
 *
 * It is still worth doing, because the failure it actually prevents is the likely one: a director
 * signing with the wrong key by accident. It cannot be the only guard, and nothing here should be
 * described as proof of identity.
 *
 * The scan is deliberately narrow — find the OID, read the string after it — rather than a full
 * ASN.1 parse. A parser would be more code and more ways to be wrong for a job that is one lookup,
 * and it would still not verify anything.
 */

/**
 * DER encoding of OID 1.2.860.3.16.1.1 (O'zbekiston TIN/STIR), as it appears inside the
 * certificate's subject: tag 0x06 (OBJECT IDENTIFIER), length 7, then the encoded arcs.
 *
 *   1.2  → 40×1 + 2      = 0x2A
 *   860  → base-128      = 0x86 0x5C
 *   3, 16, 1, 1          = 0x03 0x10 0x01 0x01
 */
const TIN_OID_DER = Buffer.from([0x06, 0x07, 0x2a, 0x86, 0x5c, 0x03, 0x10, 0x01, 0x01]);

/** DER string tags an INN may be encoded with. PrintableString in practice; UTF8String allowed. */
const STRING_TAGS = new Set([0x13, 0x0c, 0x16]); // PrintableString, UTF8String, IA5String

/**
 * Every INN found in the signature's certificates.
 *
 * Returns all of them rather than "the signer's", because identifying which certificate signed
 * would mean parsing the PKCS#7 structure properly — and the chain's other certificates (the CA)
 * carry their own INN, which simply will not be ours. Checking membership is enough to tell a
 * firm key from a personal one, which is the question being asked.
 */
export function extractCertInns(pkcs7Base64: string): string[] {
  let der: Buffer;
  try {
    der = Buffer.from(pkcs7Base64, 'base64');
  } catch {
    return [];
  }

  const found: string[] = [];
  let from = 0;
  for (;;) {
    const at = der.indexOf(TIN_OID_DER, from);
    if (at === -1) break;
    from = at + TIN_OID_DER.length;

    // Immediately after the OID comes the attribute value: <tag> <length> <bytes>. Only the short
    // form matters — an INN is 9 digits, so a multi-byte length here means this is not one.
    const tag = der[from];
    const len = der[from + 1];
    if (tag === undefined || len === undefined || !STRING_TAGS.has(tag) || len > 0x7f) continue;

    const value = der.subarray(from + 2, from + 2 + len).toString('latin1').trim();
    // Uzbek INN/STIR is exactly 9 digits. Anything else came from a different attribute that
    // happened to follow the same bytes, and must not be mistaken for one.
    if (/^\d{9}$/.test(value)) found.push(value);
  }
  return [...new Set(found)];
}

/** Does this signature carry the organisation's own INN? */
export function signatureCarriesInn(pkcs7Base64: string, orgInn: string): boolean {
  return extractCertInns(pkcs7Base64).includes(orgInn.trim());
}

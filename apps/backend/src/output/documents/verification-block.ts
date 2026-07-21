import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import QRCode from 'qrcode';
import { CaseDocData } from './case-document.loader';

/**
 * The verification footer stamped onto every frozen document: a hairline, then the org's identity
 * and a QR pointing at the public check page.
 *
 * It is added at freeze time rather than inside the 19 templates, for two reasons. The templates
 * reproduce reference workbooks cell for cell and this block is ours, not the blank's — editing
 * each of them would put it under a different heading in each. And the QR only exists once a
 * signature does, so a template that always drew one would be drawing a dead link most of the time.
 */

/** Where a scanned QR lands. Per-case, not per-document: one page lists the whole signed set. */
export function caseVerifyUrl(caseId: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.PUBLIC_VERIFY_URL;
  if (!base) {
    /*
      Refusing to render is recoverable; a wrong URL on paper is not. A missing env var would
      otherwise yield `http://localhost:3000/v/...` silently — every document from that deploy
      carrying a QR that resolves to nothing, discovered whenever someone first scans one, and
      unfixable then, because an issued document cannot be re-printed.
    */
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PUBLIC_VERIFY_URL is not set — refusing to print a QR that points at localhost. ' +
          'Set it before signing, not after: the URL is frozen into the stored PDF.',
      );
    }
    return `http://localhost:3000/v/${caseId}`;
  }
  return `${base.replace(/\/$/, '')}/v/${caseId}`;
}

/**
 * QR PNG data-URL for the case's public URL.
 *
 * 512px: the document prints this at 22mm — ~260px at 300dpi, ~520px at 600dpi — and a code
 * resampled up from 240 loses its module edges on paper. Level Q keeps it readable when a muhr or
 * a crease covers part of it; a printed page has no second chance to reload.
 */
export function caseQrDataUrl(caseId: string, baseUrl?: string, width = 512): Promise<string> {
  return QRCode.toDataURL(caseVerifyUrl(caseId, baseUrl), {
    width,
    margin: 1,
    errorCorrectionLevel: 'Q',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/**
 * The block itself. Right-aligned under a hairline that marks where the document ends and
 * verification begins — the org line carries the INN, which is what identifies the signer on paper.
 */
export function verificationBlock(c: CaseDocData, qrDataUrl: string): Content {
  const org = c.organization;
  const orgLine = [org?.nameUpper, org?.inn ? `ИНН: ${org.inn}` : null].filter(Boolean).join('   ');

  return {
    // Kept on one page with its hairline: a QR split across a page break is not scannable.
    unbreakable: true,
    margin: [0, 18, 0, 0],
    table: {
      widths: ['*', 64],
      body: [
        [
          {
            stack: [
              { text: 'Ҳужжат ҳақиқийлигини текширинг', bold: true },
              { text: 'QR кодни сканерланг' },
              { text: orgLine, margin: [0, 2, 0, 0] },
            ],
            fontSize: 8,
            color: '#475569',
            alignment: 'right',
            margin: [0, 8, 6, 0],
          },
          { image: qrDataUrl, width: 62, margin: [0, 4, 0, 0] },
        ],
      ],
    },
    // Only the hairline above the row — the block is a footer, not a boxed table.
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#cbd5e1',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

/**
 * Append the block to a built document definition.
 *
 * `content` is typed as a union that includes a single Content, so normalise to an array rather
 * than assuming the templates all return one — they do today, but this must not break quietly if
 * one ever returns a bare object.
 */
export function withVerificationBlock(
  def: TDocumentDefinitions,
  c: CaseDocData,
  qrDataUrl: string,
): TDocumentDefinitions {
  const existing = Array.isArray(def.content) ? def.content : [def.content];
  return { ...def, content: [...existing, verificationBlock(c, qrDataUrl)] };
}

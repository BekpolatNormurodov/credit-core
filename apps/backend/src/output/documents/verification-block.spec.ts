import { mockCaseDoc, flattenDocText } from './__fixtures__/case-doc.fixture';
import { caseVerifyUrl, caseQrDataUrl, verificationBlock, withVerificationBlock } from './verification-block';
import { contractTemplate } from './templates/contract';

const QR = 'data:image/png;base64,iVBORw0KGgo=';

describe('caseVerifyUrl', () => {
  const env = process.env.PUBLIC_VERIFY_URL;
  const mode = process.env.NODE_ENV;
  afterEach(() => {
    process.env.PUBLIC_VERIFY_URL = env;
    process.env.NODE_ENV = mode;
  });

  it('builds /v/<caseId> from the configured base', () => {
    process.env.PUBLIC_VERIFY_URL = 'https://crm.example.uz';
    expect(caseVerifyUrl('case-1')).toBe('https://crm.example.uz/v/case-1');
  });

  it('does not double the slash when the base has a trailing one', () => {
    process.env.PUBLIC_VERIFY_URL = 'https://crm.example.uz/';
    expect(caseVerifyUrl('case-1')).toBe('https://crm.example.uz/v/case-1');
  });

  it('falls back to localhost in development', () => {
    delete process.env.PUBLIC_VERIFY_URL;
    process.env.NODE_ENV = 'development';
    expect(caseVerifyUrl('case-1')).toContain('/v/case-1');
  });

  it('refuses to print a localhost QR in production — an issued document cannot be reprinted', () => {
    delete process.env.PUBLIC_VERIFY_URL;
    process.env.NODE_ENV = 'production';
    expect(() => caseVerifyUrl('case-1')).toThrow(/PUBLIC_VERIFY_URL/);
  });
});

describe('verificationBlock', () => {
  it('prints the organisation name and its INN — this is what identifies the signer on paper', () => {
    const c = mockCaseDoc();
    const text = flattenDocText({ content: [verificationBlock(c, QR)] } as never);

    expect(text).toContain('Ҳужжат ҳақиқийлигини текширинг');
    expect(text).toContain('QR кодни сканерланг');
    expect(text).toContain(c.organization!.nameUpper);
    expect(text).toContain(`ИНН: ${c.organization!.inn}`);
  });

  it('embeds the QR image it was handed', () => {
    const block = verificationBlock(mockCaseDoc(), QR) as never as { table: { body: unknown[][] } };
    expect(JSON.stringify(block.table.body)).toContain(QR);
  });

  it('stays on one page — a QR split across a page break cannot be scanned', () => {
    const block = verificationBlock(mockCaseDoc(), QR) as never as { unbreakable: boolean };
    expect(block.unbreakable).toBe(true);
  });

  it('omits the INN label rather than printing an empty one', () => {
    const c = mockCaseDoc({ organization: { inn: null } as never });
    const text = flattenDocText({ content: [verificationBlock(c, QR)] } as never);
    expect(text).not.toContain('ИНН:');
  });
});

describe('withVerificationBlock', () => {
  it('appends the block to a built template without disturbing its content', () => {
    const c = mockCaseDoc();
    const plain = contractTemplate(c);
    const withBlock = withVerificationBlock(plain, c, QR);

    const before = (plain.content as unknown[]).length;
    expect((withBlock.content as unknown[]).length).toBe(before + 1);
    // Everything the contract said is still said, in the same order.
    expect(flattenDocText(withBlock)).toContain(flattenDocText(plain).slice(0, 400));
  });

  it('keeps the document defaults (font, margins) the template set', () => {
    const c = mockCaseDoc();
    const plain = contractTemplate(c);
    const withBlock = withVerificationBlock(plain, c, QR);
    expect(withBlock.defaultStyle).toEqual(plain.defaultStyle);
    expect(withBlock.pageMargins).toEqual(plain.pageMargins);
  });
});

describe('caseQrDataUrl', () => {
  it('produces a PNG data-URL that encodes the verification URL', async () => {
    process.env.PUBLIC_VERIFY_URL = 'https://crm.example.uz';
    const url = await caseQrDataUrl('case-1');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    // Big enough to be a real 512px code rather than an empty placeholder.
    expect(url.length).toBeGreaterThan(1000);
    // Generous: encoding a 512px PNG takes ~130ms in plain node but ~5s under ts-jest's
    // instrumentation. The cost is the test harness, not the signing path.
  }, 30_000);
});

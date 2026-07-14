import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { actTemplate } from './act';
import { prikazTemplate } from './prikaz';
import { rklGenTemplate } from './rkl-gen';
import { DOC_REGISTRY } from '../registry';

const NOTARY_MARK = 'НОТАРИАЛ ТАСДИҚ';

describe('notary variants', () => {
  const c = mockCaseDoc();
  const templates: Array<{ name: string; build: (c: ReturnType<typeof mockCaseDoc>, notary?: boolean) => unknown }> = [
    { name: 'actTemplate', build: actTemplate as never },
    { name: 'prikazTemplate', build: prikazTemplate as never },
    { name: 'rklGenTemplate', build: rklGenTemplate as never },
  ];

  for (const { name, build } of templates) {
    describe(name, () => {
      it('appends the notarial-attestation block when notary=true', () => {
        const text = flattenDocText(build(c, true) as never);

        expect(text).toContain(NOTARY_MARK);
        expect(text).toContain('Реестр рақами');
        expect(text).toContain('М.У.');
        expect(text).toContain(c.borrower!.pinfl!);
        expect(text).toContain(c.borrower!.passportSeries!);
        expect(text).toContain(c.borrower!.passportNumber!);
      });

      it('does NOT contain the notarial block by default (notary omitted)', () => {
        const text = flattenDocText(build(c) as never);

        expect(text).not.toContain(NOTARY_MARK);
      });

      it('does not leak a raw datetime (no GMT string, no HH:MM:SS) in the notary variant', () => {
        const text = flattenDocText(build(c, true) as never);

        expect(text).not.toContain('GMT');
        expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
      });
    });
  }

  describe('registry entries', () => {
    it.each(['actNotary', 'prikazNotary', 'rklGenNotary'] as const)('%s builds a def with content', (key) => {
      const entry = DOC_REGISTRY[key];
      expect(entry).toBeDefined();
      const def = entry.build(c);
      expect(def.content).toBeDefined();

      const text = flattenDocText(def);
      expect(text).toContain(NOTARY_MARK);
    });
  });
});

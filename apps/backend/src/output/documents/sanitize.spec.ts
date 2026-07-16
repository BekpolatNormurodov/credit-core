import { sanitizeText, sanitizeDocDefinition } from './sanitize';

describe('sanitizeText', () => {
  it('maps the font-less Uzbek modifier apostrophes onto U+2019', () => {
    // Roboto has no glyph for ʻ (U+02BB) / ʼ (U+02BC) — they would print as tofu boxes.
    expect(sanitizeText('"Kafolat" sugʻurta')).toBe('"Kafolat" sug’urta');
    expect(sanitizeText('roʻyxatdan oʻtgan')).toBe('ro’yxatdan o’tgan');
    expect(sanitizeText('KOʼP QAVATLI')).toBe('KO’P QAVATLI');
  });

  it('leaves ordinary text (and the apostrophes Roboto does have) untouched', () => {
    expect(sanitizeText("KO'P QAVATLI UYDAGI XONADON")).toBe("KO'P QAVATLI UYDAGI XONADON");
    expect(sanitizeText('Бир юз эллик миллион сўм')).toBe('Бир юз эллик миллион сўм');
  });
});

describe('sanitizeDocDefinition', () => {
  it('sanitises strings anywhere in the document tree', () => {
    const def = {
      content: [
        { text: 'sugʻurta' },
        { stack: [{ text: ['aʻb', 'cʼd'] }] },
        { table: { body: [[{ text: 'oʻtgan' }, { text: 42 }]] } },
      ],
    };
    const out = sanitizeDocDefinition(def) as typeof def;

    expect(JSON.stringify(out)).not.toMatch(/[ʻʼ]/);
    expect(out.content[0].text).toBe('sug’urta');
    // Non-strings survive unchanged.
    expect(out.content[2].table!.body[0][1].text).toBe(42);
  });

  it('passes Date values through untouched', () => {
    const d = new Date('2026-07-14T00:00:00.000Z');
    const out = sanitizeDocDefinition({ when: d }) as { when: Date };
    expect(out.when).toBe(d);
  });
});

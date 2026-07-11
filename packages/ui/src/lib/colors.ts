/**
 * Avtomobil ranglari — garov formasidagi "Rang" dropdown va tex-skaner uchun. Har rang: canonik
 * o'zbekcha nom + swatch uchun hex + OCR mos kelishi uchun sinonimlar (o'zbekcha/ruscha varianti,
 * masalan "BELIY" → Oq). tex passport rangni aralash yozadi ("OQ BELIY"), shuning uchun sinonimlar.
 */
export interface CarColor { name: string; hex: string; syn?: string[] }

export const CAR_COLORS: CarColor[] = [
  { name: 'Oq', hex: '#F1F3F6', syn: ['OQ', 'BELIY', 'BELYY', 'WHITE'] },
  { name: 'Sadaf oq', hex: '#EAE6DA', syn: ['SADAF', 'PERLAMUTR', 'PEARL', 'BELIY PERLAMUTR'] },
  { name: 'Sut rang', hex: '#EFEDE3', syn: ['SUT', 'MOLOCHNIY'] },
  { name: 'Qora', hex: '#17181B', syn: ['QORA', 'CHERNIY', 'CHYORNIY', 'BLACK'] },
  { name: "To'q kulrang", hex: '#43474D', syn: ['TOQ KULRANG', 'TEMNO SERIY', 'GRAFIT', 'GRAPHITE'] },
  { name: 'Kulrang', hex: '#888D94', syn: ['KULRANG', 'SERIY', 'SERYY', 'GREY', 'GRAY'] },
  { name: 'Och kulrang', hex: '#B8BCC2', syn: ['OCH KULRANG', 'SVETLO SERIY'] },
  { name: 'Kumush', hex: '#C6CACE', syn: ['KUMUSH', 'SEREBRISTIY', 'SEREBRO', 'SILVER'] },
  { name: 'Metallik', hex: '#9CA2A8', syn: ['METALLIK', 'METALLIC'] },
  { name: 'Bej', hex: '#DBC9A6', syn: ['BEJ', 'BEJEVIY', 'BEIGE'] },
  { name: 'Krem', hex: '#EDE4CB', syn: ['KREM', 'KREMOVIY', 'CREAM'] },
  { name: 'Shampan', hex: '#E3D3A9', syn: ['SHAMPAN', 'SHAMPANSKIY', 'CHAMPAGNE'] },
  { name: 'Tillarang', hex: '#C7A64C', syn: ['TILLA', 'TILLARANG', 'ZOLOTISTIY', 'ZOLOTOY', 'GOLD'] },
  { name: 'Bronza', hex: '#9C6B3C', syn: ['BRONZA', 'BRONZOVIY', 'BRONZE'] },
  { name: 'Mis', hex: '#B5713F', syn: ['MIS', 'MEDNIY', 'COPPER'] },
  { name: 'Jigarrang', hex: '#7A5140', syn: ['JIGARRANG', 'KORICHNEVIY', 'BROWN'] },
  { name: "To'q jigarrang", hex: '#46301F', syn: ['TOQ JIGARRANG', 'TEMNO KORICHNEVIY'] },
  { name: 'Xaki', hex: '#78866B', syn: ['XAKI', 'KHAKI'] },
  { name: 'Qizil', hex: '#D23B3B', syn: ['QIZIL', 'KRASNIY', 'RED'] },
  { name: "To'q qizil", hex: '#9E2A2A', syn: ['TOQ QIZIL', 'TEMNO KRASNIY'] },
  { name: 'Bordo', hex: '#7A2230', syn: ['BORDO', 'BORDOVIY', 'VISHNYA', 'VISHNYOVIY'] },
  { name: 'Pushti', hex: '#E86CA0', syn: ['PUSHTI', 'ROZOVIY', 'PINK'] },
  { name: 'Narinji', hex: '#EA8A2E', syn: ['NARINJI', 'ORANJEVIY', 'ORANGE'] },
  { name: 'Sariq', hex: '#F2C230', syn: ['SARIQ', 'JYOLTIY', 'JELTIY', 'YELLOW'] },
  { name: 'Oltin sariq', hex: '#E0B94A', syn: ['OLTIN SARIQ', 'ZOLOTISTO JELTIY'] },
  { name: 'Yashil', hex: '#3AA655', syn: ['YASHIL', 'ZELYONIY', 'ZELENIY', 'GREEN'] },
  { name: "To'q yashil", hex: '#1E5E32', syn: ['TOQ YASHIL', 'TEMNO ZELYONIY'] },
  { name: 'Och yashil', hex: '#7BC47F', syn: ['OCH YASHIL', 'SVETLO ZELYONIY'] },
  { name: 'Zumrad', hex: '#2E8B7A', syn: ['ZUMRAD', 'IZUMRUD', 'EMERALD'] },
  { name: "Ko'k", hex: '#2F6FE0', syn: ['KOK', 'SINIY', 'BLUE'] },
  { name: "To'q ko'k", hex: '#1C3F82', syn: ['TOQ KOK', 'TEMNO SINIY', 'NAVY'] },
  { name: "Och ko'k", hex: '#6FB2E8', syn: ['OCH KOK', 'GOLUBOY', 'SVETLO SINIY'] },
  { name: 'Zangori', hex: '#3FB6D3', syn: ['ZANGORI', 'BIRYUZOVIY', 'FIRUZA', 'TURQUOISE'] },
  { name: 'Binafsha', hex: '#7B45B0', syn: ['BINAFSHA', 'FIOLETOVIY', 'PURPLE', 'SIRENEVIY'] },
  { name: "Ko'k-kulrang", hex: '#5A6B82', syn: ['KOK KULRANG', 'SINE SERIY'] },
  { name: "Qo'ng'ir", hex: '#8A6B4F', syn: ['QONGIR', 'KOFEYNIY'] },
  { name: 'Grafit', hex: '#33363B', syn: ['GRAFIT', 'GRAPHITE', 'ANTRATSIT'] },
  { name: 'Mokko', hex: '#6B5044', syn: ['MOKKO', 'MOCHA'] },
  { name: 'Bej-kulrang', hex: '#C3B7A0', syn: ['BEJ KULRANG', 'SERO BEJEVIY'] },
  { name: 'Boshqa', hex: '#B0B4BA', syn: ['BOSHQA', 'DRUGOY'] },
];

/** Letters only, upper-cased (apostrophes/spaces stripped) — so a misread matches regardless of format. */
const flat = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '');

// token/phrase (flattened) → canonical color name. Longer keys first so "TOQKOK" beats "KOK".
const COLOR_KEY: Array<{ key: string; name: string }> = CAR_COLORS
  .flatMap((c) => [c.name, ...(c.syn ?? [])].map((s) => ({ key: flat(s), name: c.name })))
  .filter((x) => x.key.length >= 2)
  .sort((a, b) => b.key.length - a.key.length);

/**
 * Snap an OCR'd colour to a canonical car colour. "OQ BELIY" → "Oq", "SEREBRISTIY" → "Kumush",
 * "TEMNO SINIY" → "To'q ko'k". Tries the whole phrase first (multi-word shades), then each word.
 * Returns null when nothing recognised (kept as free text).
 */
export function matchCarColor(ocr: string): string | null {
  const whole = flat(ocr);
  for (const { key, name } of COLOR_KEY) if (key.length >= 5 && (whole === key || whole.startsWith(key))) return name;
  for (const tok of ocr.toUpperCase().split(/\s+/)) {
    const f = flat(tok);
    const hit = COLOR_KEY.find((k) => k.key === f);
    if (hit) return hit.name;
  }
  return null;
}

/** Hex for a canonical colour name (for the swatch), or undefined. */
export function colorHex(name: string): string | undefined {
  return CAR_COLORS.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.hex;
}

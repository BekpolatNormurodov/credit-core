/**
 * ISO 3166-1 alpha-3 nationality code → Uzbek display name.
 * UZB is the primary case; the rest cover the ~20 nationalities seen in practice.
 * Unknown codes fall through to the raw code so nothing is silently dropped.
 */
export const NATIONALITY_UZ: Record<string, string> = {
  UZB: 'O‘zbekiston Respublikasi',
  RUS: 'Rossiya Federatsiyasi',
  KAZ: 'Qozog‘iston',
  KGZ: 'Qirg‘iziston',
  TJK: 'Tojikiston',
  TKM: 'Turkmaniston',
  AZE: 'Ozarbayjon',
  ARM: 'Armaniston',
  GEO: 'Gruziya',
  BLR: 'Belarus',
  UKR: 'Ukraina',
  MDA: 'Moldova',
  TUR: 'Turkiya',
  AFG: 'Afg‘oniston',
  CHN: 'Xitoy',
  KOR: 'Janubiy Koreya',
  IND: 'Hindiston',
  PAK: 'Pokiston',
  IRN: 'Eron',
  USA: 'AQSh',
  DEU: 'Germaniya',
  GBR: 'Buyuk Britaniya',
};

/** Localized nationality name for an MRZ alpha-3 code; raw code if unknown, '' if absent. */
export function nationalityName(code?: string | null): string {
  if (!code) return '';
  const c = code.toUpperCase().replace(/[^A-Z]/g, '');
  return NATIONALITY_UZ[c] ?? c;
}

/** Ordered citizenship dropdown options: every mapped name (UZB first) + 'Boshqa'. */
export const NATIONALITY_OPTIONS: string[] = [...Object.values(NATIONALITY_UZ), 'Boshqa'];

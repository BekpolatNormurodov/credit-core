import type { Content, TableCell } from 'pdfmake/interfaces';
import { moneyWithWordsCyr, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable } from '../doc-layout';

type Collateral = CaseDocData['collaterals'][number];

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));
const owner = (c: Collateral): string => c.owners?.[0]?.fullName ?? '—';

/** Short "SURNAME N.P." form of a full name, as the forms abbreviate owners (e.g. "UBAYDULLAYEV Z.N."). */
export function shortName(full: string | null | undefined): string {
  if (!full) return '—';
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initials = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + '.').join('');
  return `${parts[0]} ${initials}`;
}

// ── AUTO ─────────────────────────────────────────────────────────────────────

/** Prose auto-collateral description, as the Кредитная заявка / shartnoma print it. */
export function autoDescription(c: Collateral): string {
  return (
    `${shortName(owner(c))} га тегишли давлат рақам белгиси ${dash(c.stateNumber)}, ` +
    `тип кузова - ${dash(c.bodyType)}, кузов №${dash(c.bodyNo)}, ` +
    `двигатель №${dash(c.engineNo)}, шасси - ${dash(c.chassis)}, ` +
    `ранги - ${dash(c.color)}, ${dash(c.year)} йилда ишлаб чиқарилган., ` +
    `${dash(c.model)} русумли автомототранспорт гарови. ` +
    `Гаров қиймати нархи ${moneyWithWordsCyr(c.agreedValue)}.`
  );
}

const AUTO_HEADER: TableCell[] = [
  { text: 'Мулк номи', bold: true, alignment: 'center' },
  { text: 'Кузов тури ва кузов рақами', bold: true, alignment: 'center' },
  { text: 'Двигател рақами ва шасси рақами', bold: true, alignment: 'center' },
  { text: 'Ишлаб чиқарилган йили ва ранги', bold: true, alignment: 'center' },
  { text: 'Гаров қийматининг келишилган нархи, сўм', bold: true, alignment: 'center' },
];

/** The 5-column auto value table (Приказ / Кредитная заявка). */
export function autoValueTable(collaterals: Collateral[]): Content {
  const rows: TableCell[][] = collaterals.map((c) => [
    { text: dash(c.model) },
    { text: `тип кузова - ${dash(c.bodyType)}, кузов №${dash(c.bodyNo)}` },
    { text: `двигатель №${dash(c.engineNo)}, шасси - ${dash(c.chassis)}` },
    { text: `ранги - ${dash(c.color)}, ${dash(c.year)} йилда ишлаб чиқарилган.` },
    { text: moneyWithWordsCyr(c.agreedValue) },
  ]);
  return {
    table: { headerRows: 1, widths: ['*', '*', '*', '*', '*'], body: [AUTO_HEADER, ...rows] },
    layout: gridTable,
    margin: [0, 4, 0, 6],
  };
}

/** Footnote lines under the auto table (эгаси / тех паспорт / гараж / давлат рақами). */
export function autoFootnotes(c: Collateral): Content[] {
  const tp = c.techPassportNo
    ? `${c.techPassportNo}${c.techPassportDate ? ` от ${dateToRuCyrillic(c.techPassportDate)}` : ''}`
    : '—';
  return [
    { text: `* Автомототранспорт воситаси эгаси: ${owner(c)}`, fontSize: 9 },
    { text: `* техник паспорт рақами: ${tp}`, fontSize: 9 },
    { text: `* рўйхатдан ўтган манзил/гараж манзили: ${dash(c.address)}`, fontSize: 9 },
    { text: `* давлат рақами: ${dash(c.stateNumber)}`, fontSize: 9 },
  ];
}

// ── REAL ESTATE ──────────────────────────────────────────────────────────────

const realtyWord = (c: Collateral): string => (c.realtyKind === 'HOUSE' ? 'ҲОВЛИ' : 'ТУРАР ЖОЙ');

/** The composition sentence used in the first cell of the real-estate table. */
export function realtyComposition(c: Collateral): string {
  return (
    `Хоналар сони: ${dash(c.roomCount)} та, ` +
    `Давлат рўйхатидан ўтказилган ер майдони - ${dash(c.landAreaM2)} кв.м., ` +
    `умумий майдони (ташқи) - ${dash(c.totalAreaM2)} кв.м., ` +
    `умумий фойдали майдони - ${dash(c.usableAreaM2)} кв.м., ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м.`
  );
}

/** Prose real-estate description, as the Кредитная заявка prints it. */
export function realtyDescription(c: Collateral): string {
  return (
    `${dash(c.address)} манзилда жойлашган, умумий майдони - ${dash(c.totalAreaM2)} кв.м. ва ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м. бўлган, ${shortName(owner(c))} га тегишли ` +
    `${realtyWord(c).toLowerCase()} гарови. Гаров қиймати нархи ${moneyWithWordsCyr(c.agreedValue)}.`
  );
}

/** Real-estate value table (Акт согласования / Приказ). `withValue` adds the залоговая стоимость column. */
export function realtyValueTable(collaterals: Collateral[], withValue = true): Content {
  const header: TableCell[] = [
    { text: 'Ушбу кўчмас мулк объектнинг таркиби ва таснифи', bold: true, alignment: 'center' },
    { text: 'Яшаш майдони', bold: true, alignment: 'center' },
    { text: 'Давлат рўйхатидан ўтказилган ер майдони', bold: true, alignment: 'center' },
  ];
  if (withValue) header.push({ text: 'Келишилган гаров қиймати, сўм', bold: true, alignment: 'center' });

  const rows: TableCell[][] = collaterals.map((c) => {
    const row: TableCell[] = [
      { text: realtyComposition(c) },
      { text: `${dash(c.livingAreaM2)} кв.м.`, alignment: 'center' },
      { text: `${dash(c.landAreaM2)} кв.м.`, alignment: 'center' },
    ];
    if (withValue) row.push({ text: moneyWithWordsCyr(c.agreedValue) });
    return row;
  });

  const totalLiving = collaterals.reduce((s, c) => s + Number(c.livingAreaM2 ?? 0), 0);
  const totalLand = collaterals.reduce((s, c) => s + Number(c.landAreaM2 ?? 0), 0);
  const totalRow: TableCell[] = [
    { text: 'ЖАМИ', bold: true },
    { text: `${totalLiving} кв.м.`, bold: true, alignment: 'center' },
    { text: `${totalLand} кв.м.`, bold: true, alignment: 'center' },
  ];
  if (withValue) totalRow.push({ text: '' });

  const widths = withValue ? ['*', 70, 90, '*'] : ['*', 80, 110];
  return {
    table: { headerRows: 1, widths, body: [header, ...rows, totalRow] },
    layout: gridTable,
    margin: [0, 4, 0, 6],
  };
}

/** Footnote lines under the real-estate table (эгаси / реестр / кадастр / манзил). */
export function realtyFootnotes(c: Collateral): Content[] {
  return [
    { text: `-* кўчмас мулк эгаси: ${owner(c)}`, fontSize: 9 },
    { text: `-* реестр рақами: ${dash(c.registryNo)}`, fontSize: 9 },
    { text: `-* кадастр рақами: ${dash(c.cadastreNo)}`, fontSize: 9 },
    { text: `-* манзил: ${dash(c.address)}`, fontSize: 9 },
  ];
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/** True when the case is backed only by vehicles (drives "полис скрыть" and auto-only wording). */
export function isAutoOnly(c: CaseDocData): boolean {
  const cols = c.collaterals ?? [];
  return cols.length > 0 && cols.every((x) => x.type === 'AUTO');
}

/** Full collateral block (table + footnotes) for a form, dispatching per type. */
export function collateralBlock(c: CaseDocData, opts: { realtyWithValue?: boolean } = {}): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [{ text: 'Гаров киритилмаган', italics: true }];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) {
    out.push(autoValueTable(autos));
    autos.forEach((a) => out.push(...autoFootnotes(a)));
  }
  if (realty.length) {
    out.push(realtyValueTable(realty, opts.realtyWithValue ?? true));
    realty.forEach((r) => out.push(...realtyFootnotes(r)));
  }
  return out;
}

import type { Content, TableCell } from 'pdfmake/interfaces';
import { moneyWithWordsCyr } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, shortDate } from '../doc-layout';

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

// Headers verbatim from the Excel, including the trailing asterisks that key the footnotes below.
const AUTO_HEAD_BASE: TableCell[] = [
  { text: 'Мулк номи*', bold: true, alignment: 'center' },
  { text: 'Кузов тури ва кузов рақами*', bold: true, alignment: 'center' },
  { text: 'Двигател рақами ва шасси рақами*', bold: true, alignment: 'center' },
  { text: 'Ишлаб чиқарилган йили ва ранги*', bold: true, alignment: 'center' },
];
const AUTO_VALUE_COL: TableCell = { text: 'Гаров қийматининг келишилган нархи, сўм', bold: true, alignment: 'center' };

/** The auto value table. `withValue` adds the "Гаров қиймати" column (Приказ / act table 2). */
export function autoValueTable(collaterals: Collateral[], withValue = true): Content {
  const header = withValue ? [...AUTO_HEAD_BASE, AUTO_VALUE_COL] : AUTO_HEAD_BASE;
  const rows: TableCell[][] = collaterals.map((c) => {
    const row: TableCell[] = [
      { text: dash(c.model) },
      { text: `тип кузова - ${dash(c.bodyType)}, кузов №${dash(c.bodyNo)}` },
      { text: `двигатель №${dash(c.engineNo)}, шасси - ${dash(c.chassis)}` },
      { text: `ранги - ${dash(c.color)}, ${dash(c.year)} йилда ишлаб чиқарилган.` },
    ];
    if (withValue) row.push({ text: moneyWithWordsCyr(c.agreedValue) });
    return row;
  });
  const widths = withValue ? [70, '*', '*', 78, 92] : [80, '*', '*', 90];
  return {
    fontSize: 8,
    table: { headerRows: 1, widths, body: [header, ...rows] },
    layout: gridTable,
    margin: [0, 4, 0, 6],
  };
}

/** Footnote lines under the auto table (эгаси / тех паспорт / гараж / давлат рақами). */
export function autoFootnotes(c: Collateral): Content[] {
  const tp = c.techPassportNo
    ? `${c.techPassportNo}${c.techPassportDate ? ` от ${shortDate(c.techPassportDate)} г.` : ''}`
    : '—';
  return [
    { text: `* Автомототранспорт воситаси эгаси: ${owner(c)}`, fontSize: 9 },
    { text: `* техник паспорт рақами: ${tp}`, fontSize: 9 },
    { text: `* рўйхатдан ўтган манзил/гараж манзили: ${dash(c.address)}`, fontSize: 9 },
    { text: `* давлат рақами: ${dash(c.stateNumber)}`, fontSize: 9 },
  ];
}

// ── REAL ESTATE ──────────────────────────────────────────────────────────────

/**
 * The registry classification the forms print for a pledged property — e.g.
 * "YAKKA TARTIBDAGI TURAR JOY" (house) or "KO'P QAVATLI UYDAGI XONADON" (apartment).
 * Comes from the stored `propertyType`; falls back to the realtyKind wording when absent.
 */
export function realtyWord(c: Collateral): string {
  if (c.propertyType) return c.propertyType;
  return c.realtyKind === 'HOUSE' ? 'YAKKA TARTIBDAGI TURAR JOY' : "KO'P QAVATLI UYDAGI XONADON";
}

/**
 * The composition sentence used in the first cell of the real-estate table.
 * Wording/spelling copied verbatim from the reference Excel ("кучмас", "руйхатидан утказилган",
 * "(ташки)") so the printed form is identical to it.
 */
export function realtyComposition(c: Collateral): string {
  return (
    `Хоналар сони: ${dash(c.roomCount)} та, ` +
    `Давлат руйхатидан утказилган ер майдони - ${dash(c.landAreaM2)} кв.м., ` +
    `умумий майдони (ташки) - ${dash(c.totalAreaM2)} кв.м., ` +
    `умумий фойдали майдони - ${dash(c.usableAreaM2)} кв.м., ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м..`
  );
}

/**
 * Prose real-estate description, verbatim in the Кредитная заявка / Мурожаатнома shape:
 * "<address> манзилда жойлашган, Давлат руйхатидан утказилган ер майдони - X кв.м., курилиш ости
 *  майдони - Y кв.м., умумий фойдали майдони - Z кв.м., яшаш майдони - W кв.м., бўлган,
 *  <OWNER S.N.>га тегишли <PROPERTY TYPE> гарови. Гаров қиймати нархи <sum>."
 */
export function realtyDescription(c: Collateral): string {
  return (
    `${dash(c.address)} манзилда жойлашган, ` +
    `Давлат руйхатидан утказилган ер майдони - ${dash(c.landAreaM2)} кв.м., ` +
    `курилиш ости майдони - ${dash(c.totalAreaM2)} кв.м., ` +
    `умумий фойдали майдони - ${dash(c.usableAreaM2)} кв.м., ` +
    `яшаш майдони - ${dash(c.livingAreaM2)} кв.м., бўлган, ` +
    `${shortName(owner(c))}га тегишли ${realtyWord(c)} гарови. ` +
    `Гаров қиймати нархи ${moneyWithWordsCyr(c.agreedValue)}.`
  );
}

/** Real-estate value table (Акт согласования / Приказ). `withValue` adds the залоговая стоимость column. */
export function realtyValueTable(collaterals: Collateral[], withValue = true): Content {
  // Headers verbatim from the Excel — note the value column is Russian there, unlike the auto table.
  const header: TableCell[] = [
    { text: 'Ушбу кучмас мулк объектнинг таркиби ва таснифи', bold: true, alignment: 'center' },
    { text: 'Яшаш майдони', bold: true, alignment: 'center' },
    { text: 'Давлат руйхатидан утказилган ер майдони', bold: true, alignment: 'center' },
  ];
  // "стоимонсть" is the reference sheet's own spelling — kept verbatim so the form matches 1:1.
  if (withValue) header.push({ text: 'Согласованная залоговая стоимонсть, сум', bold: true, alignment: 'center' });

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
  const totalValue = collaterals.reduce((s, c) => s + Number(c.agreedValue ?? 0), 0);
  const totalRow: TableCell[] = [
    { text: 'ЖАМИ', bold: true },
    { text: `${totalLiving} кв.м.`, bold: true, alignment: 'center' },
    { text: `${totalLand} кв.м.`, bold: true, alignment: 'center' },
  ];
  // The Excel's ЖАМИ row carries the summed agreed value in the value column.
  if (withValue) totalRow.push({ text: moneyWithWordsCyr(totalValue), bold: true });

  const widths = withValue ? ['*', 60, 78, 92] : ['*', 78, 104];
  return {
    fontSize: 8,
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

/** Акт table 1 — the DECLARED composition (no value column) + footnotes, per type. */
export function collateralDeclaredBlock(c: CaseDocData): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [{ text: 'Гаров киритилмаган', italics: true }];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) {
    out.push(autoValueTable(autos, false));
    autos.forEach((a) => out.push(...autoFootnotes(a)));
  }
  if (realty.length) {
    out.push(realtyValueTable(realty, false));
    realty.forEach((r) => out.push(...realtyFootnotes(r)));
  }
  return out;
}

/** Акт table 2 — the AGREED value tables (with the залоговая стоимость column), no footnotes. */
export function collateralAgreedTables(c: CaseDocData): Content[] {
  const cols = c.collaterals ?? [];
  if (cols.length === 0) return [];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');
  const out: Content[] = [];
  if (autos.length) out.push(autoValueTable(autos, true));
  if (realty.length) out.push(realtyValueTable(realty, true));
  return out;
}

/** Total agreed collateral value (sum of agreedValue across collaterals). */
export function totalAgreedValue(c: CaseDocData): number {
  return (c.collaterals ?? []).reduce((s, x) => s + Number(x.agreedValue ?? 0), 0);
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

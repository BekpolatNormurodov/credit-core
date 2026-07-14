import type { Content, TableCell } from 'pdfmake/interfaces';
import type { CaseDocData } from './case-document.loader';

/**
 * Diagonal watermark for a case status: the text + colour. Pending review → grey "TASDIQLANMAGAN";
 * once the director signs (ADMIN_FINALIZE) and after finalize → green "TASDIQLANGAN"; rejected/
 * cancelled → red. null when no watermark applies (e.g. DRAFT — no documents yet).
 */
export function watermarkForStatus(status: string): { text: string; color: string } | null {
  if (status === 'REJECTED') return { text: 'RAD ETILGAN', color: '#dc2626' };
  if (status === 'CANCELLED') return { text: 'BEKOR QILINGAN', color: '#dc2626' };
  if (status === 'MODERATION' || status === 'DIRECTOR_REVIEW') return { text: 'TASDIQLANMAGAN', color: '#9ca3af' };
  if (status === 'ADMIN_FINALIZE' || status === 'FINALIZED') return { text: 'TASDIQLANGAN', color: '#16a34a' };
  return null;
}

/**
 * The status badge shown next to a document in the UI. Mirrors the watermark, but as a labelled
 * tone the frontend can colour: pending (grey) while under review, approved (green) once the director
 * has signed (FINALIZED / legacy ADMIN_FINALIZE), rejected (red) if the case was refused/cancelled.
 * null for DRAFT (no documents yet).
 */
export type DocBadgeTone = 'pending' | 'approved' | 'rejected';
export function docBadgeForStatus(status: string): { label: string; tone: DocBadgeTone } | null {
  switch (status) {
    case 'FINALIZED':
    case 'ADMIN_FINALIZE':
      return { label: 'Tasdiqlangan', tone: 'approved' };
    case 'MODERATION':
    case 'DIRECTOR_REVIEW':
      return { label: 'Tasdiqlanmagan', tone: 'pending' };
    case 'REJECTED':
      return { label: 'Rad etilgan', tone: 'rejected' };
    case 'CANCELLED':
      return { label: 'Bekor qilingan', tone: 'rejected' };
    default:
      return null;
  }
}

export const money = (n: unknown): string =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU').format(Number(n)) + " so'm";

/**
 * Shared document defaults — bumped line height (1.15, per the "kattaroq line orasi" request) so
 * every rebuilt template reads like the Excel forms. Templates spread this into `defaultStyle`.
 */
export const DOC_DEFAULT_STYLE = { font: 'Roboto', fontSize: 10, lineHeight: 1.15 } as const;
export const DOC_PAGE_MARGINS: [number, number, number, number] = [45, 50, 45, 50];

/** Centered, bold, larger chapter/section heading (e.g. "1. КЕЛИШУВ ПРЕДМЕТИ"). */
export function sectionTitle(text: string): Content {
  return { text, bold: true, fontSize: 11.5, alignment: 'center', margin: [0, 10, 0, 6] };
}

/** Left-aligned bold sub-heading inside a form section. */
export function subHeading(text: string): Content {
  return { text, bold: true, fontSize: 11, margin: [0, 8, 0, 4] };
}

/** A two-column label/value row for a pdfmake table body. */
export const kv = (label: string, val: string): TableCell[] => [
  { text: label, bold: true, margin: [0, 3, 0, 3] },
  { text: val || '—', margin: [0, 3, 0, 3] },
];

/** Clean grid layout for a key/value or data table — thin light-gray borders + comfortable padding. */
export const gridTable = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#c8d0da',
  vLineColor: () => '#c8d0da',
  paddingTop: () => 5,
  paddingBottom: () => 5,
  paddingLeft: () => 8,
  paddingRight: () => 8,
};

/** Wrap key/value rows in a bordered two-column table. */
export function kvTable(rows: TableCell[][], labelWidth: number | string = 190): Content {
  return { table: { widths: [labelWidth, '*'], body: rows }, layout: gridTable, margin: [0, 2, 0, 4] };
}

/** Centered document title (bold) with an optional subtitle line under it. */
export function docTitle(title: string, subtitle?: string): Content {
  const stack: Content[] = [{ text: title, bold: true, fontSize: 14, alignment: 'center' }];
  if (subtitle) stack.push({ text: subtitle, alignment: 'center', color: '#444', fontSize: 9.5, margin: [0, 2, 0, 0] });
  return { stack, margin: [0, 4, 0, 12] };
}

/** Two-column signature block (left party / right party). */
export function signatures(left: string[], right: string[]): Content {
  const col = (lines: string[]) => ({
    width: '*',
    stack: [
      ...lines.map((t, i) => ({ text: t, bold: i === 0 })),
      { text: '\n___________________', margin: [0, 4, 0, 0] as [number, number, number, number] },
    ],
  });
  return { columns: [col(left), col(right)], columnGap: 24, margin: [0, 22, 0, 0] };
}

/** Org letterhead block from the Organization record — centered name + address, with a divider rule. */
export function orgHeader(org: CaseDocData['organization']): Content {
  return {
    stack: [
      { text: org?.nameUpper ?? 'МКО', bold: true, fontSize: 12, alignment: 'center' },
      { text: org?.address ?? '', fontSize: 8, color: '#555', alignment: 'center' },
      { text: [org?.bankName, org?.bankAccount].filter(Boolean).join(' · '), fontSize: 8, color: '#555', alignment: 'center' },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 505, y2: 4, lineWidth: 0.8, lineColor: '#94a3b8' }], margin: [0, 4, 0, 0] },
    ],
    margin: [0, 0, 0, 14],
  };
}

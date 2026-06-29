/**
 * Uzbek (latin) number-to-words for monetary "prописью" fields on the
 * valuation act and generated PDFs. Replaces the Excel `n_1..n_5` / `тыс` /
 * `мил` named-range logic.
 *
 * Example: 84_000_000 → "sakson to'rt million so'm 00 tiyin"
 */

const ONES = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const TENS = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"];
const SCALES = ['', 'ming', 'million', 'milliard', 'trillion'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    parts.push(ONES[hundreds], 'yuz');
  }
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;
  if (tens > 0) parts.push(TENS[tens]);
  if (ones > 0) parts.push(ONES[ones]);
  return parts.filter(Boolean).join(' ');
}

/** Convert a non-negative integer to Uzbek words. */
export function integerToUzbekWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'nol';

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;
    words.push(threeDigitsToWords(group));
    if (SCALES[i]) words.push(SCALES[i]);
  }
  return words.join(' ').trim();
}

/**
 * Format a sum as an Uzbek "prописью" string:
 * "<words> so'm <tiyin:00> tiyin".
 */
export function sumToWordsUz(amount: number): string {
  const soum = Math.floor(Math.abs(amount));
  const tiyin = Math.round((Math.abs(amount) - soum) * 100);
  const words = integerToUzbekWords(soum);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const tiyinStr = String(tiyin).padStart(2, '0');
  return `${capitalized} so'm ${tiyinStr} tiyin`;
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** Format a date as Uzbek words, e.g. 2026-06-25 → "25 iyun 2026 yil" (UTC-based). */
export function dateToUzbekWords(d: Date): string {
  return `${d.getUTCDate()} ${UZ_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} yil`;
}

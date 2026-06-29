/**
 * Single source of truth for chart (recharts) colors.
 *
 * recharts paints SVG via JS color strings, so it cannot consume Tailwind
 * classes — these hex values are the ONLY sanctioned place for raw chart hex.
 * They mirror the design tokens (brand / gray / status) so charts stay on-brand
 * and theme-aware. Pages must import from here instead of inlining hex.
 */
import { CaseStatus, ProductType } from '@credit-core/shared';

/** Light-tuned base hex (mirror the -600/-700 tokens). */
export const chartPalette = {
  brand: '#0369a1', // brand-700
  brandSoft: '#0ea5e9', // brand-500
  warning: '#dc6803', // warning-600
  success: '#039855', // success-600
  error: '#d92d20', // error-600
  violet: '#7c3aed',
  grayTick: '#667085', // gray-500
};

/**
 * Theme-aware series colors. recharts paints raw hex, so series can't react to
 * dark mode via CSS — on a dark canvas the -600/-700 hues are muddy (brand-700 is
 * only 2.99:1 on gray-900), so we step up to the bright -400 stops. Pass
 * `theme === 'dark'`.
 */
export const chartSeries = (dark: boolean) => ({
  brand: dark ? '#38bdf8' : '#0369a1', // brand-400 | brand-700
  brandSoft: dark ? '#7dd3fc' : '#0ea5e9', // brand-300 | brand-500
  warning: dark ? '#fdb022' : '#dc6803', // warning-400 | -600
  success: dark ? '#32d583' : '#039855', // success-400 | -600
  error: dark ? '#f97066' : '#d92d20', // error-400 | -600
  violet: dark ? '#a78bfa' : '#7c3aed', // violet-400 | -600
});

/** Axis grid / tick colors per theme (light | dark). */
export const chartAxis = (dark: boolean) => ({
  grid: dark ? 'rgba(255,255,255,.08)' : '#e4e7ec', // gray-200
  tick: dark ? '#98a2b3' : '#667085', // gray-400 | gray-500
});

/** Product → series color (theme-aware). */
export const productColor = (dark: boolean): Record<ProductType, string> => {
  const s = chartSeries(dark);
  return {
    [ProductType.REAL_ESTATE]: s.brand,
    [ProductType.AUTO]: s.warning,
  };
};

/** Case status → series color (theme-aware; matches the StatusBadge intent). */
export const statusColor = (dark: boolean): Record<CaseStatus, string> => {
  const s = chartSeries(dark);
  return {
    [CaseStatus.DRAFT]: dark ? '#d0d5dd' : '#98a2b3', // gray-300 | gray-400
    [CaseStatus.MODERATION]: s.warning,
    [CaseStatus.DIRECTOR_REVIEW]: s.violet,
    [CaseStatus.ADMIN_FINALIZE]: s.brand,
    [CaseStatus.FINALIZED]: s.success,
    [CaseStatus.REJECTED]: s.error,
    [CaseStatus.CANCELLED]: dark ? '#98a2b3' : '#667085', // gray-400 | gray-500 — aborted (distinct from rejected red)
  };
};

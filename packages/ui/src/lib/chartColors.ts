/**
 * Single source of truth for chart (recharts) colors.
 *
 * recharts paints SVG via JS color strings, so it cannot consume Tailwind
 * classes — these hex values are the ONLY sanctioned place for raw chart hex.
 * They mirror the design tokens (brand / gray / status) so charts stay on-brand
 * and theme-aware. Pages must import from here instead of inlining hex.
 */
import { CaseStatus, ProductType } from '@credit-core/shared';

/** Brand + status hex, aligned with the Tailwind tokens. */
export const chartPalette = {
  brand: '#0369a1', // brand-700
  brandSoft: '#0ea5e9', // brand-500
  warning: '#dc6803', // warning-600
  success: '#039855', // success-600
  error: '#d92d20', // error-600
  violet: '#7c3aed',
  grayTick: '#667085', // gray-500
};

/** Axis grid / tick colors per theme (light | dark). */
export const chartAxis = (dark: boolean) => ({
  grid: dark ? 'rgba(255,255,255,.08)' : '#e4e7ec', // gray-200
  tick: dark ? '#98a2b3' : '#667085', // gray-400 | gray-500
});

/** Product → series color. */
export const productColor: Record<ProductType, string> = {
  [ProductType.REAL_ESTATE]: chartPalette.brand,
  [ProductType.AUTO]: chartPalette.warning,
};

/** Case status → series color (matches the StatusBadge intent). */
export const statusColor: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: '#98a2b3', // gray-400
  [CaseStatus.MODERATION]: chartPalette.warning,
  [CaseStatus.DIRECTOR_REVIEW]: chartPalette.violet,
  [CaseStatus.ADMIN_FINALIZE]: chartPalette.brand,
  [CaseStatus.FINALIZED]: chartPalette.success,
  [CaseStatus.REJECTED]: chartPalette.error,
  [CaseStatus.CANCELLED]: chartPalette.grayTick, // gray-500 — aborted (distinct from rejected red)
};

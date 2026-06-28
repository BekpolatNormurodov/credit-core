/**
 * Shared Tailwind preset for all 4 web apps.
 * Palette driven by ui-ux-pro-max: "Authority navy + trust gold" (Banking/
 * Legal/Fintech) — conveys trust for a credit/collateral product.
 * Semantic tokens (surface/muted/border/ring + status) avoid raw hex in
 * components.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Authority navy/indigo — primary brand.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4f5fd6',
          600: '#3a45b8',
          700: '#2c3596',
          800: '#1e3a8a', // authority navy (primary)
          900: '#172554',
        },
        // Trust gold — accent for finance highlights (KATM, values).
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#d4a017',
          500: '#b45309',
          600: '#92400e',
        },
        // Status (functional color always paired with icon/text in UI).
        success: { 50: '#ecfdf5', 100: '#d1fae5', 600: '#059669', 700: '#047857' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 600: '#d97706', 700: '#b45309' },
        danger: { 50: '#fef2f2', 100: '#fee2e2', 600: '#dc2626', 700: '#b91c1c' },
        // Neutral surface system.
        surface: '#ffffff',
        canvas: '#f6f8fb',
        ink: '#0f172a',
        muted: '#64748b',
        hairline: '#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        // Consistent elevation scale (elevation-consistent).
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        soft: '0 12px 32px -12px rgba(30, 58, 138, 0.28)',
        pop: '0 20px 50px -16px rgba(15, 23, 42, 0.30)',
      },
    },
  },
  plugins: [],
};

/**
 * Shared Tailwind preset for all 4 web apps.
 * Palette from ui-ux-pro-max CLI "Data-Dense Dashboard": professional navy
 * (#0F172A) chrome + blue CTA (#0369A1). Fira Sans body / Fira Code headings.
 * Semantic tokens (surface/muted/hairline + status) avoid raw hex in components.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Blue CTA (primary actions / active state / focus) — skill accent #0369A1.
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1', // accent/CTA
          800: '#075985',
          900: '#0c4a6e',
        },
        // Navy chrome (sidebar accents, splash, emphasis) — skill primary #0F172A.
        navy: {
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
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
        // Body: Fira Sans; headings/data: Fira Code (skill "data/technical/precise").
        sans: ['Fira Sans', 'system-ui', 'sans-serif'],
        heading: ['Fira Code', 'ui-monospace', 'monospace'],
        mono: ['Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        soft: '0 12px 32px -12px rgba(3, 105, 161, 0.28)',
        pop: '0 20px 50px -16px rgba(15, 23, 42, 0.30)',
      },
    },
  },
  plugins: [],
};

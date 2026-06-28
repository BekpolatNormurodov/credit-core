/**
 * Shared Tailwind preset for all 4 web apps — single source of truth for the look.
 *
 * Design language: TailAdmin (clean, calm, professional) built around the
 * project's OWN blue brand ramp (brand-700 #0369a1 = accent/CTA). From TailAdmin
 * we adopt the neutral gray ramp, status colors, soft theme shadows and Outfit —
 * NOT indigo. The brand ramp is intentionally untouched.
 *
 * Neutrals are mapped onto the TailAdmin gray ramp at the TOKEN level so every
 * screen shifts together: the semantic aliases (surface/canvas/ink/muted/hairline),
 * plus `slate`/`navy`/`danger`, all resolve to gray/error values. Components must
 * keep using tokens (never raw hex) so the whole product stays consistent.
 */

// TailAdmin neutral gray ramp (single source — reused for `gray`, `slate`, aliases).
const gray = {
  25: '#fcfcfd',
  50: '#f9fafb',
  100: '#f2f4f7',
  200: '#e4e7ec',
  300: '#d0d5dd',
  400: '#98a2b3',
  500: '#667085',
  600: '#475467',
  700: '#344054',
  800: '#1d2939',
  900: '#101828',
  950: '#0c111d',
};

// Status ramps: skill values for 50/500/600, kept 100/700 for existing call sites.
const success = { 50: '#ecfdf3', 100: '#d1fae5', 500: '#12b76a', 600: '#039855', 700: '#047857' };
const warning = { 50: '#fffaeb', 100: '#fef3c7', 500: '#f79009', 600: '#dc6803', 700: '#b45309' };
const error = { 50: '#fef3f2', 100: '#fee2e2', 500: '#f04438', 600: '#d92d20', 700: '#b91c1c' };

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Blue CTA (primary actions / active state / focus) — brand stays, 700 = accent.
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1', // accent / CTA
          800: '#075985',
          900: '#0c4a6e',
        },
        // TailAdmin neutral ramp.
        gray,
        // `slate-*` is used widely across the app — re-point it at the gray ramp so
        // existing usages adopt TailAdmin neutrals without per-file edits.
        slate: gray,
        // Dark chrome shades (legacy `navy-*` usages) mapped onto the gray ramp.
        navy: { 700: gray[700], 800: gray[800], 900: gray[900] },
        // Status (functional color, always paired with icon/text in UI).
        success,
        warning,
        error,
        danger: error, // legacy alias — same red as `error`
        // Semantic neutral aliases mapped onto the gray ramp.
        surface: '#ffffff',
        canvas: gray[50],
        ink: gray[800],
        muted: gray[500],
        hairline: gray[200],
      },
      fontFamily: {
        // Outfit everywhere (TailAdmin); Fira Code reserved for monospace/codes.
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        // TailAdmin soft shadows — the only shadows the admin chrome should use.
        'theme-sm': '0 1px 3px 0 rgba(16,24,40,.10), 0 1px 2px 0 rgba(16,24,40,.06)',
        'theme-md': '0 4px 8px -2px rgba(16,24,40,.10), 0 2px 4px -2px rgba(16,24,40,.06)',
        // Legacy aliases re-pointed to neutral (no colored glows) for back-compat.
        card: '0 1px 3px 0 rgba(16,24,40,.10), 0 1px 2px 0 rgba(16,24,40,.06)',
        soft: '0 4px 8px -2px rgba(16,24,40,.10), 0 2px 4px -2px rgba(16,24,40,.06)',
        pop: '0 16px 32px -12px rgba(16,24,40,.20)',
      },
    },
  },
  plugins: [],
};

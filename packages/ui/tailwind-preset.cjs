/** Shared Tailwind preset for all 4 web apps. */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec2ff',
          400: '#599fff',
          500: '#337bff',
          600: '#1c5cf5',
          700: '#1547e1',
          800: '#183bb6',
          900: '#19378f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(28, 92, 245, 0.25)',
      },
    },
  },
  plugins: [],
};

const preset = require('@credit-core/ui/tailwind-preset');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    join(__dirname, '../../packages/ui/src/**/*.{ts,tsx}'),
  ],
};

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Pin the suite's timezone. Without this, date behaviour depends on whoever is
// running the tests: CI runs in UTC while the developers run in Asia/Jerusalem,
// so a date test could pass locally and fail on CI (or worse, the reverse).
// Asia/Jerusalem specifically, because it is the timezone the product is built
// for and the one whose UTC offset exposes date bugs — see
// src/utils/dateUtils.localDate.test.js.
// Set here rather than in the npm script so it works without cross-env on
// Windows, and before any test module evaluates a Date.
process.env.TZ = 'Asia/Jerusalem';

export default defineConfig({
  // Mirrors vite.config.js's injection so version.test.js exercises the same
  // value the real build produces, instead of an undefined global.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx}', '.agents/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});

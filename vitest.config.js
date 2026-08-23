import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

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

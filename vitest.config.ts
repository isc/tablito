// Config Vitest. Aliase `react` vers `preact/compat` pour exécuter la suite
// sous Preact tout en gardant le code applicatif écrit avec les imports
// React (utilisés uniquement pour les types côté TS).
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  resolve: {
    alias: {
      'react/jsx-runtime':       'preact/jsx-runtime',
      'react/jsx-dev-runtime':   'preact/jsx-runtime',
      'react-dom/test-utils':    'preact/test-utils',
      'react-dom/client':        'preact/compat/client',
      'react-dom':               'preact/compat',
      'react':                   'preact/compat',
      '@testing-library/react':  '@testing-library/preact',
      'virtual:pwa-register':    path.join(ROOT, 'scripts/pwa-register-noop.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 120_000,
  },
})

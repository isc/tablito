// Ordre des feuilles CSS de src/ (scripts/css-order.mjs), partagé par le dev
// server et le build : la cascade en dépend.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSrcCssFiles } from './css-order.mjs';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('listSrcCssFiles', () => {
  it('trie par code units, sans dépendre de la locale', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'css-order-'));
    try {
      for (const rel of [
        'index.css', 'App.css', 'Theme.css', 'main.tsx',
        'components/base.css', 'components/Button.css',
        'screens/_shared.css', 'screens/HomeScreen.css',
        '__tests__/fixture.css',
      ]) {
        await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
        await fs.writeFile(path.join(dir, rel), '');
      }

      // En commentaire, la place que leur donnait `localeCompare`.
      expect(await listSrcCssFiles(dir)).toEqual([
        'App.css',
        'Theme.css', // la dernière
        'components/Button.css',
        'components/base.css', // avant Button.css
        'index.css',
        'screens/HomeScreen.css',
        'screens/_shared.css', // la première des écrans
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Ce dont dépend la cascade du vrai src/.
  it('range les composants avant les écrans', async () => {
    const files = await listSrcCssFiles(SRC);
    const lastComponent = files.findLastIndex((f) => f.startsWith('components/'));
    const firstScreen = files.findIndex((f) => f.startsWith('screens/'));

    expect(lastComponent).toBeGreaterThanOrEqual(0);
    expect(firstScreen).toBeGreaterThan(lastComponent);
  });
});

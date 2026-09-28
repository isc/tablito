// Slug des previews : preview.yml publie sous previews/<slug>/, et
// preview-cleanup.yml recalcule le slug de chaque PR ouverte pour supprimer
// tous les autres dossiers. Si les deux calculs divergeaient, chaque fermeture
// de PR effacerait les previews des PR ouvertes.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');

function slugFunction(workflow) {
  const lines = fs.readFileSync(path.join(WORKFLOWS, workflow), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('slug() {'));
  expect(lines).toHaveLength(1);
  return lines[0];
}

describe('slug des previews', () => {
  it('est calculé par la même fonction dans preview.yml et preview-cleanup.yml', () => {
    expect(slugFunction('preview-cleanup.yml')).toBe(slugFunction('preview.yml'));
  });
});

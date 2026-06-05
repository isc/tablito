// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { createNewProfile } from '../lib/storage';
import { composeDailySession } from '../lib/dailyComposer';

const NOW = '2026-06-02';

// Toutes les tables maîtrisées (boîte 5). nextDue par défaut très loin → aucune
// table due ; on rapproche certaines pour simuler l'entretien.
function masteredProfile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.facts = p.facts.map((f) => ({
    ...f,
    box: 5 as const,
    introduced: true,
    lastSeen: '2026-01-01',
    nextDue: '2099-12-31',
    history: [{ date: '2026-01-01', correct: true, responseTimeMs: 1000, answeredWith: f.product }],
  }));
  return p;
}

describe('composeDailySession (séance mixte §11.6)', () => {
  it('aucune table due → séance 100% division', () => {
    const session = composeDailySession(masteredProfile(), NOW);
    expect(session.length).toBeGreaterThan(0);
    expect(session.every((i) => i.kind === 'div')).toBe(true);
  });

  it('des tables dues → entretien mélangé à la division', () => {
    const p = masteredProfile();
    // 3 faits multiplicatifs dus aujourd'hui.
    p.facts = p.facts.map((f, i) => (i < 3 ? { ...f, nextDue: NOW } : f));
    const session = composeDailySession(p, NOW);
    const mult = session.filter((i) => i.kind === 'mult');
    const div = session.filter((i) => i.kind === 'div');
    expect(mult.length).toBeGreaterThan(0);
    expect(div.length).toBeGreaterThan(0);
    // Les tables n'apparaissent qu'en révision (jamais en intro post-déblocage).
    expect(mult.every((i) => !i.isIntroduction)).toBe(true);
  });

  it('plafonne l\'entretien des tables (ne noie pas la division)', () => {
    const p = masteredProfile();
    // Toutes les tables dues → l'entretien doit rester borné.
    p.facts = p.facts.map((f) => ({ ...f, nextDue: NOW }));
    const session = composeDailySession(p, NOW);
    const mult = session.filter((i) => i.kind === 'mult');
    expect(mult.length).toBeLessThanOrEqual(6);
  });
});

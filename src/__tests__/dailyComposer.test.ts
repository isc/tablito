// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { createNewProfile } from '../lib/storage';
import { composeDailySession } from '../lib/dailyComposer';

const NOW = '2026-06-02';

// Toutes les tables maîtrisées (boîte 5). nextDue par défaut très loin → aucune
// table due ; on rapproche certaines pour simuler l'entretien. Aucun fait de
// division introduit → représente le DÉBLOCAGE FRAIS (1ers jours du niveau 2).
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

// Division déjà bien entamée : tous les faits de division introduits et dus →
// composeDivisionSession produit à lui seul une séance pleine. Représente le
// régime de croisière du niveau 2.
function matureDivisionProfile(): UserProfile {
  const p = masteredProfile();
  p.divisionFacts = (p.divisionFacts ?? []).map((f) => ({
    ...f,
    box: 3 as const,
    introduced: true,
    lastSeen: '2026-01-01',
    nextDue: NOW,
    history: [{ date: '2026-01-01', correct: true, responseTimeMs: 1000, answeredWith: f.quotient }],
  }));
  return p;
}

describe('composeDailySession (séance mixte §11.6)', () => {
  it('division mature + aucune table due → séance 100% division, pleine', () => {
    const session = composeDailySession(matureDivisionProfile(), NOW);
    expect(session.every((i) => i.kind === 'div')).toBe(true);
    expect(session.length).toBeGreaterThanOrEqual(12);
  });

  it('des tables dues → entretien mélangé à la division', () => {
    const p = matureDivisionProfile();
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

  it("plafonne l'entretien dû des tables à 6 (ne noie pas la division)", () => {
    const p = matureDivisionProfile();
    // Toutes les tables dues → l'entretien (faits dus, hors bonus) reste borné.
    p.facts = p.facts.map((f) => ({ ...f, nextDue: NOW }));
    const session = composeDailySession(p, NOW);
    const maintenance = session.filter((i) => i.kind === 'mult' && !i.isBonusReview);
    expect(maintenance.length).toBeLessThanOrEqual(6);
  });

  it('PLANCHER — 1ère séance post-déblocage atteint le minimum malgré peu de division', () => {
    // Déblocage frais : aucune division introduite, aucune table due → sans
    // filet la séance tomberait à ~2 questions. Le padding bonus la remplit.
    const session = composeDailySession(masteredProfile(), NOW);
    expect(session.length).toBeGreaterThanOrEqual(12);
    // 2 intros de division en tête + complétée par des révisions bonus (faute
    // de division introduite, le bonus vient des tables).
    const divIntros = session.filter((i) => i.kind === 'div' && i.isIntroduction);
    expect(divIntros.length).toBeGreaterThan(0);
    expect(session.some((i) => i.kind === 'mult' && i.isBonusReview)).toBe(true);
  });

  it('PLANCHER — quelques tables dues mais division thin → toujours rempli au minimum', () => {
    const p = masteredProfile();
    p.facts = p.facts.map((f, i) => (i < 3 ? { ...f, nextDue: NOW } : f));
    const session = composeDailySession(p, NOW);
    expect(session.length).toBeGreaterThanOrEqual(12);
  });
});

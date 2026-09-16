// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { createNewProfile } from '../lib/storage';
import { composeDailySession, MAX_MAINTENANCE } from '../lib/dailyComposer';

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

  it("plafonne l'entretien dû des tables (ne noie pas la division)", () => {
    const p = matureDivisionProfile();
    // Toutes les tables dues → l'entretien (faits dus, hors bonus) reste borné.
    p.facts = p.facts.map((f) => ({ ...f, nextDue: NOW }));
    const session = composeDailySession(p, NOW);
    const maintenance = session.filter((i) => i.kind === 'mult' && !i.isBonusReview);
    expect(maintenance.length).toBeLessThanOrEqual(MAX_MAINTENANCE);
  });

  // Vécu en prod : un profil ouvre la division avec ses 36 tables en boîte 4+,
  // puis 14 d'entre elles repassent sous la maîtrise en trois mois — revues au
  // compte-tapis parce que l'entretien tirait ses faits AU HASARD parmi les dus.
  // Un fait en boîte 5 (revu tous les 21 jours) prenait le slot d'un fait en
  // boîte 1 qui revient chaque jour. Comme une division exige un parent en
  // boîte 4+, 12 divisions sur 64 restaient verrouillées derrière (specs §11.3).
  describe("l'entretien sert les faits fragiles en premier", () => {
    // `n` tables retombées en boîte 1, toutes dues, noyées parmi 36 dus.
    // Elles sont placées en FIN de tableau : en tête, un simple `slice` les
    // prendrait sans rien prioriser et le test ne verrouillerait rien.
    function withFallen(n: number): UserProfile {
      const p = matureDivisionProfile();
      const first = p.facts.length - n;
      p.facts = p.facts.map((f, i) =>
        i >= first ? { ...f, box: 1 as const, nextDue: NOW } : { ...f, nextDue: NOW },
      );
      return p;
    }
    const maintenanceOf = (p: UserProfile) =>
      composeDailySession(p, NOW).filter((i) => i.kind === 'mult' && !i.isBonusReview);

    it('donne TOUS les slots aux faits tombés quand il y en a assez', () => {
      const items = maintenanceOf(withFallen(MAX_MAINTENANCE + 2));
      expect(items).toHaveLength(MAX_MAINTENANCE);
      // Aucun fait maîtrisé ne vole un slot à un fait en boîte 1.
      expect(items.every((i) => i.kind === 'mult' && i.fact.box === 1)).toBe(true);
    });

    it('complète par des faits maîtrisés quand les fragiles ne remplissent pas', () => {
      const items = maintenanceOf(withFallen(2));
      expect(items).toHaveLength(MAX_MAINTENANCE);
      const fallen = items.filter((i) => i.kind === 'mult' && i.fact.box === 1);
      expect(fallen).toHaveLength(2);
    });

    it("ne relève PAS le plafond quand la fondation s'effrite", () => {
      // Tentation écartée, mesurée : au-delà du fragile, réviser plus dégrade
      // la fondation (aucun gain possible en boîte 5, 20 % de chances de faire
      // retomber le fait) et ampute le niveau actif. Le budget n'est pas le
      // problème — le tirage l'était.
      expect(maintenanceOf(withFallen(20))).toHaveLength(MAX_MAINTENANCE);
    });

    it('laisse sa place au niveau actif dans tous les cas', () => {
      const session = composeDailySession(withFallen(20), NOW);
      expect(session.filter((i) => i.kind === 'div').length).toBeGreaterThan(0);
    });
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

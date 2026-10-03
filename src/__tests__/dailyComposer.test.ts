// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile, SessionItem } from '../types';
import { createNewProfile } from '../lib/storage';
import { composeDailySession, MAX_MAINTENANCE } from '../lib/dailyComposer';
import { getDivisionFactKey } from '../lib/divisionFacts';
import { withDueDivisions, withOneDivisionPerDividend } from './helpers/divisionProfiles';

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
// la division remplit à elle seule une séance pleine. Représente le régime de
// croisière du niveau 2.
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

// Les `n` premières tables deviennent dues : l'entretien du jour.
function withDueTables(p: UserProfile, n: number): UserProfile {
  p.facts = p.facts.map((f, i) => (i < n ? { ...f, nextDue: NOW } : f));
  return p;
}

describe('composeDailySession (séance mixte §11.6)', () => {
  it('division mature + aucune table due → séance 100% division, pleine', () => {
    const session = composeDailySession(matureDivisionProfile(), NOW);
    expect(session.every((i) => i.kind === 'div')).toBe(true);
    expect(session.length).toBeGreaterThanOrEqual(12);
  });

  it('des tables dues → entretien mélangé à la division', () => {
    const session = composeDailySession(withDueTables(matureDivisionProfile(), 3), NOW);
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

  it("coupe les révisions de division par priorité quand l'entretien leur prend des places", () => {
    // 14 divisions dues (4 en boîte 1, 4 en boîte 3, 6 en boîte 5) et 6 tables
    // dues : l'entretien prend 6 des 15 places, il en reste 9 pour la division.
    // Elles vont aux plus fragiles. Coupée dans l'ordre de la séance, la
    // sélection pouvait écarter une révision plus fragile qu'une autre gardée.
    const boxes = [1, 1, 1, 1, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5] as const;
    const p = withOneDivisionPerDividend(
      withDueTables(masteredProfile(), MAX_MAINTENANCE),
      boxes.map((box) => ({ box, nextDue: NOW })),
    );

    const session = composeDailySession(p, NOW);

    const div = session.filter((i) => i.kind === 'div');
    expect(div.every((i) => !i.isIntroduction && !i.isBonusReview)).toBe(true);
    expect(div.map((i) => i.fact.box).sort()).toEqual([1, 1, 1, 1, 3, 3, 3, 3, 5]);
    expect(session.filter((i) => i.kind === 'mult')).toHaveLength(MAX_MAINTENANCE);
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
    const session = composeDailySession(withDueTables(masteredProfile(), 3), NOW);
    expect(session.length).toBeGreaterThanOrEqual(12);
  });

  // Premières semaines du niveau 2 : `due` divisions dues, une réserve de 12
  // divisions introduites non dues pour le bonus, des intros possibles (toutes
  // les tables sont prêtes) et `maintenance` tables dues.
  function earlyDivisionProfile(due: number, maintenance: number): UserProfile {
    const state = (nextDue: string) => ({ box: 3 as const, nextDue });
    return withOneDivisionPerDividend(withDueTables(masteredProfile(), maintenance), [
      ...Array.from({ length: due }, () => state(NOW)),
      ...Array.from({ length: 12 }, () => state('2099-12-31')),
    ]);
  }

  // Le plancher se compte sur la séance entière, entretien compris (§11.3).
  it.each([
    // [divisions dues, tables dues, bonus attendus, longueur attendue]
    [3, 6, 1, 12],
    [3, 3, 4, 12],
    [4, 6, 0, 12],
    [3, 0, 7, 12],
    // 15 − 2 intros − 6 tables : 7 divisions retenues sur 9.
    [9, 6, 0, 15],
  ])(
    'PLANCHER — 2 intros + %i divisions + %i tables dues → %i bonus, %i questions',
    (due, maintenance, bonus, length) => {
      const session = composeDailySession(earlyDivisionProfile(due, maintenance), NOW);
      expect(session).toHaveLength(length);
      expect(session.filter((i) => i.isIntroduction)).toHaveLength(2);
      // Le bonus puise d'abord dans le niveau actif.
      const bonusItems = session.filter((i) => i.isBonusReview);
      expect(bonusItems).toHaveLength(bonus);
      expect(bonusItems.every((i) => i.kind === 'div')).toBe(true);
    },
  );

  it('ne garde pas deux divisions de même dividende quand la séance atteint le plancher sans elles', () => {
    // 7 divisions dues sur 5 dividendes (12÷3 et 12÷4, 15÷3 et 15÷5) et 6
    // tables dues : 2 intros + 5 + 6 = 13, la règle du dividende (§11.6) n'a
    // pas à être relâchée.
    const p = withDueDivisions(withDueTables(masteredProfile(), MAX_MAINTENANCE), [
      '12/3', '12/4', '15/3', '15/5', '16/4', '18/6', '35/7',
    ]);

    const session = composeDailySession(p, NOW);

    expect(session).toHaveLength(13);
    expect(session.some((i) => i.isBonusReview)).toBe(false);
    const dividends = session.flatMap((i) =>
      i.kind === 'div' && !i.isIntroduction ? [i.fact.dividend] : [],
    );
    expect(dividends).toHaveLength(5);
    expect(new Set(dividends).size).toBe(5);
  });

  // La règle du dividende (§11.6) ne comparait que les révisions dues entre
  // elles : une intro pouvait côtoyer une révision de même dividende, et un
  // bonus prendre celui de n'importe quelle division de la séance. Seul
  // l'entrelacement les séparait.
  describe('aucune division de la séance ne partage son dividende', () => {
    // Division bien entamée : tout est introduit sauf 56÷8, l'intro du jour, et
    // rien n'est dû hors `due`. Le reste attend en boîte 5, réserve de bonus,
    // sauf `weak`, en boîte 2 : les premiers bonus tirés.
    function withIntro56(due: string[], weak: string[] = []): UserProfile {
      const p = masteredProfile();
      p.divisionFacts = p.divisionFacts!.map((f) => {
        const key = getDivisionFactKey(f.dividend, f.divisor);
        if (key === '56/8') return f;
        const dueToday = due.includes(key);
        return {
          ...f,
          introduced: true,
          box: dueToday ? 3 : weak.includes(key) ? 2 : 5,
          lastSeen: '2026-01-01',
          nextDue: dueToday ? NOW : '2099-12-31',
        };
      });
      return p;
    }
    const dividendsOf = (session: SessionItem[]) =>
      session.flatMap((i) => (i.kind === 'div' ? [i.fact.dividend] : []));

    it("reporte la révision due au dividende de l'intro, même quand la séance est maigre", () => {
      // 1 intro + 2 révisions : les bonus comblent le plancher, 56÷7 attend la
      // séance suivante plutôt que de côtoyer 56÷8 le jour où il est enseigné.
      const session = composeDailySession(withIntro56(['56/7', '12/3']), NOW);

      expect(session).toHaveLength(12);
      expect(session[0]).toMatchObject({ kind: 'div', isIntroduction: true, fact: { dividend: 56 } });
      const dividends = dividendsOf(session);
      expect(new Set(dividends).size).toBe(dividends.length);
      expect(dividends).toContain(12);
    });

    it.each([
      ["de l'intro du jour", [], ['56/7']],
      ["d'une révision due", ['12/3'], ['12/4']],
      ["d'un autre bonus", [], ['24/4', '24/6']],
    ])('ne tire aucun bonus au dividende %s', (_, due, weak) => {
      const session = composeDailySession(withIntro56(due, weak), NOW);

      expect(session).toHaveLength(12);
      const dividends = dividendsOf(session);
      expect(new Set(dividends).size).toBe(dividends.length);
    });
  });
});

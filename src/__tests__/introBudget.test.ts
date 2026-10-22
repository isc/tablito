// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { BoxLevel, UserProfile } from '../types';
import { MAX_FRAGILE, newFactBudget } from '../lib/leitner';
import { composeSession } from '../lib/sessionComposer';
import { selectDivisionQuestions } from '../lib/divisionComposer';
import { selectRemainderQuestions } from '../lib/remainderComposer';
import { composeConjSession } from '../lib/conjugationComposer';
import { composeIrrSession } from '../lib/irregularComposer';
import { createNewProfile } from '../lib/storage';
import { createInitialDivisionFacts } from '../lib/divisionFacts';
import { createInitialRemainderFacts } from '../lib/remainderFacts';
import { createInitialConjFacts } from '../lib/conjugationFacts';
import { createInitialIrrFacts } from '../lib/irregularVerbs';

// Plafond JOURNALIER des faits neufs (specs §6.2). Une séance peut désormais
// être arrêtée en route puis relancée (§3.2) : sans ce plafond, chaque relance
// offrait deux intros de plus. Chaque composeur est vérifié avec les mêmes faits
// introduits « aujourd'hui » ou « hier » : hier est encore dans la fenêtre 48 h
// des intros en interférence, donc seul le plafond du jour fait la différence.

const TODAY = '2026-10-22';
const YESTERDAY = '2026-10-21';
const FUTURE = '2099-01-01';

/** Marque introduits, en boîte 2 et pas dus, les `count` premiers faits. */
function introduceFirst<T extends { introduced: boolean; introducedAt?: string }>(
  facts: T[],
  count: number,
  introducedAt: string,
): T[] {
  return facts.map((f, i) =>
    i < count ? { ...f, introduced: true, introducedAt, box: 2, lastSeen: introducedAt, nextDue: FUTURE } : f,
  );
}

const COMPOSERS: Record<string, (count: number, introducedAt: string) => number> = {
  multiplication: (count, at) => {
    const p = createNewProfile('Zoé');
    p.facts = introduceFirst(p.facts, count, at);
    return composeSession(p, TODAY).filter((q) => q.isIntroduction).length;
  },
  division: (count, at) => {
    const p = createNewProfile('Zoé');
    p.facts = p.facts.map((f) => ({ ...f, box: 5, introduced: true }));
    p.divisionFacts = introduceFirst(createInitialDivisionFacts(), count, at);
    return selectDivisionQuestions(p, TODAY, 0).intros.length;
  },
  'division avec reste': (count, at) => {
    const p = createNewProfile('Zoé');
    p.divisionFacts = createInitialDivisionFacts().map((f) => ({ ...f, box: 5, introduced: true }));
    p.remainderFacts = introduceFirst(createInitialRemainderFacts(), count, at);
    return selectRemainderQuestions(p, TODAY, 0).intros.length;
  },
  conjugaison: (count, at) => {
    const profile = { badges: [], conjFacts: introduceFirst(createInitialConjFacts(), count, at) };
    return composeConjSession(profile as unknown as UserProfile, TODAY).filter((q) => q.isIntroduction).length;
  },
  'verbes irréguliers': (count, at) => {
    const irrFacts = introduceFirst(createInitialIrrFacts(), count, at);
    return composeIrrSession({ irrFacts }, TODAY).filter((q) => q.isIntroduction).length;
  },
};

describe('newFactBudget', () => {
  const fact = (introducedAt?: string, box: BoxLevel = 2) => ({
    introduced: introducedAt !== undefined,
    box,
    introducedAt,
  });

  it("retire du plafond les faits introduits aujourd'hui, et seulement eux", () => {
    expect(newFactBudget([fact()], TODAY, 2)).toBe(2);
    expect(newFactBudget([fact(TODAY), fact(YESTERDAY), fact()], TODAY, 2)).toBe(1);
    expect(newFactBudget([fact(TODAY), fact(TODAY), fact(TODAY), fact()], TODAY, 2)).toBe(0);
  });

  it('vaut 0 quand trop de faits introduits sont encore fragiles (shouldIntroduceNew)', () => {
    const facts = Array.from({ length: 36 }, (_, i) => (i <= MAX_FRAGILE ? fact(YESTERDAY, 1) : fact()));
    expect(newFactBudget(facts, TODAY, 2)).toBe(0);
  });
});

describe.each(Object.entries(COMPOSERS))('plafond journalier des intros — %s', (_, intros) => {
  it("deux faits introduits hier n'empêchent pas deux intros aujourd'hui", () => {
    expect(intros(2, YESTERDAY)).toBe(2);
  });

  it("après une séance arrêtée avec deux intros, la relance n'en propose plus", () => {
    expect(intros(2, TODAY)).toBe(0);
  });

  it('après une seule intro dans la journée, il en reste une', () => {
    expect(intros(1, TODAY)).toBe(1);
  });
});

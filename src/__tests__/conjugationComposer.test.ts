// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { BoxLevel, ConjFact, UserProfile } from '../types';
import {
  composeConjSession,
  conjCarrierIndex,
  conjQuestionConflict,
  conjRetryQuestion,
  isConjAccepted,
  judgeConjAnswer,
} from '../lib/conjugationComposer';
import { canConjCoexist } from '../lib/conjugationInterference';
import {
  createInitialConjFacts,
  requireConjFactDef,
  resolveConjQuestion,
} from '../lib/conjugationFacts';
import { seedConjFromPlacement } from '../lib/conjugationPlacement';
import { conjFastThresholdMs } from '../types';

// Régressions de la composition d'une séance de conjugaison (spec Verbito
// §3.4, §5.1, §6.2). Ce que les tests d'intégration ne voient pas : les
// garde-fous d'interférence sur les chemins secondaires (padding bonus,
// jonctions de blocs) et l'ensemencement du placement.

const TODAY = '2026-08-17';

/** Profil minimal : seuls les faits nommés sont introduits. */
function profileWith(
  states: Record<string, { box: BoxLevel; due?: boolean; seen?: number }>,
): UserProfile {
  const conjFacts: ConjFact[] = createInitialConjFacts().map((f) => {
    const state = states[f.key];
    if (!state) return f;
    return {
      ...f,
      introduced: true,
      box: state.box,
      seen: state.seen,
      lastSeen: '2026-01-01',
      nextDue: state.due === false ? '2099-12-31' : '2026-01-01',
    };
  });
  return { badges: [], conjFacts } as unknown as UserProfile;
}

describe('anti-interférence, y compris sur le chemin des révisions bonus (§3.4)', () => {
  it('ne repêche jamais en bonus un fait confusible avec un fait déjà retenu', () => {
    // Le cas exact que le padding contournait : « tu es » dû, « il est » pas
    // dû — la sélection écarte le second, le bonus le reprenait aussitôt.
    const profile = profileWith({
      'pres-etre-tu': { box: 1 },
      'pres-etre-il': { box: 2, due: false },
    });

    const keys = composeConjSession(profile, TODAY).map((q) => q.fact.key);

    expect(keys).toContain('pres-etre-tu');
    expect(keys).not.toContain('pres-etre-il');
  });

  it('ne met jamais deux faits non consolidés en interférence dans la même séance', () => {
    // Toute la famille -ont introduite et non consolidée : la séance ne doit en
    // retenir qu'un seul membre, révisions dues ET bonus confondues.
    const profile = profileWith({
      'pres-etre-ils': { box: 1 },
      'pres-avoir-ils': { box: 2 },
      'pres-aller-ils': { box: 2, due: false },
      'pres-faire-ils': { box: 1, due: false },
      'pres-g1-nous': { box: 2 },
      'imp-il': { box: 2, due: false },
    });

    const questions = composeConjSession(profile, TODAY);
    for (const a of questions) {
      for (const b of questions) {
        if (a === b) continue;
        expect(canConjCoexist(a.fact, b.fact)).toBe(true);
      }
    }
  });

  it('entrelace aussi les JONCTIONS de blocs, pas seulement l’intérieur', () => {
    // Assez de faits pour que la séance ait des révisions dues ET du padding
    // bonus : la jonction entre les deux blocs échappait au contrôle.
    const states: Record<string, { box: BoxLevel; due?: boolean }> = {};
    for (const [i, key] of [
      'pres-g1-je',
      'pres-g1-tu',
      'pres-g1-il',
      'pres-g1-nous',
      'pres-g1-vous',
      'pres-g1-ils',
      'imp-je',
      'imp-tu',
      'imp-il',
      'imp-nous',
      'imp-vous',
      'imp-ils',
    ].entries()) {
      states[key] = { box: 2, due: i < 6 };
    }
    const profile = profileWith(states);

    const questions = composeConjSession(profile, TODAY);
    expect(questions.length).toBeGreaterThanOrEqual(12);
    // Best effort comme partout (interleaveGreedy), mais ici la solution
    // existe : aucune paire adjacente ne doit partager verbe ou personne.
    // Exception assumée : deux INTROS de suite, que l'ordre canonique prend au
    // même verbe (« je suis » puis « tu es ») — c'est le geste d'enseignement,
    // pas de l'entrelacement.
    for (let i = 1; i < questions.length; i++) {
      if (questions[i - 1].isIntroduction && questions[i].isIntroduction) continue;
      expect(conjQuestionConflict(questions[i - 1], questions[i])).toBe(false);
    }
  });
});

describe('rotation des phrases porteuses (§10)', () => {
  it('le re-test d’une intro réussie change de phrase porteuse', () => {
    // L'intro affiche la forme dans la porteuse 0 ; re-poser cette phrase-là
    // deux questions plus loin testerait la mémoire de l'écran, pas le fait.
    const profile = profileWith({ 'pres-g1-nous': { box: 2 } });
    const intro = composeConjSession(profile, TODAY)[0];

    const retest = conjRetryQuestion(intro);

    expect(retest.fact.key).toBe(intro.fact.key);
    expect(retest.carrierIndex).toBe(intro.carrierIndex + 1);
    const def = requireConjFactDef(intro.fact.key);
    expect(resolveConjQuestion(def, retest.carrierIndex).prompt).not.toBe(
      resolveConjQuestion(def, intro.carrierIndex).prompt,
    );
  });

  it('continue de tourner au-delà des 30 tentatives gardées en historique', () => {
    const saturated: ConjFact = {
      key: 'pres-g1-nous',
      box: 2,
      lastSeen: '2026-01-01',
      nextDue: '2026-01-01',
      history: Array.from({ length: 30 }, () => ({
        date: '2026-01-01',
        correct: true,
        responseTimeMs: 1000,
        answeredWith: null,
      })),
      introduced: true,
    };

    // Sans compteur de présentations, `history.length` reste à 30 et l'index
    // se fige sur la porteuse 0 (30 % 2 = 30 % 3 = 0).
    expect(conjCarrierIndex({ ...saturated, seen: 31 })).not.toBe(
      conjCarrierIndex({ ...saturated, seen: 32 }),
    );
  });
});

describe('ensemencement du placement (§6.1)', () => {
  it('ne place jamais un fait DÉMONTRÉ au-dessus du fait qui le démontre', () => {
    const facts = createInitialConjFacts();
    // « vous parlerez » réussi, mais très lentement (> 2× le seuil) : la sonde
    // vaut boîte 1, la preuve indirecte ne peut pas valoir mieux.
    const slow = conjFastThresholdMs('parlerez') * 3;
    seedConjFromPlacement(facts, [{ key: 'fut-vous', correct: true, timeMs: slow }], TODAY);

    const box = (key: string) => facts.find((f) => f.key === key)!.box;
    expect(box('fut-vous')).toBe(1);
    for (const implied of ['fut-je', 'fut-tu', 'fut-il', 'fut-nous', 'fut-ils', 'pres-g1-vous']) {
      expect(box(implied)).toBeLessThanOrEqual(box('fut-vous'));
    }
  });

  it('une sonde rapide, elle, ensemence bien haut', () => {
    const facts = createInitialConjFacts();
    seedConjFromPlacement(facts, [{ key: 'fut-vous', correct: true, timeMs: 1000 }], TODAY);
    expect(facts.find((f) => f.key === 'fut-je')!.box).toBe(3);
  });
});

// Le cas « verons » (rapporté en preview, 17/08/2026) : la tolérance
// phonétique du radical accepte les coquilles fidèles à la prononciation
// (dédoublement, c/s, accents) mais jamais un autre radical — et un
// « presque » est accepté sans blâme ni promotion (verrou côté écran :
// conjSession.test.tsx, « presque »).
describe('judgeConjAnswer — coquilles de radical sur « nous verrons »', () => {
  const view = resolveConjQuestion(requireConjFactDef('fut-voir'), 1);

  it('« verons » : radical irrégulier récupéré, doublement raté → presque, sans blâme', () => {
    const j = judgeConjAnswer(view, 'verons');
    expect(j.verdict).toBe('almost');
    expect(isConjAccepted(j.verdict)).toBe(true);
    expect(j.blamedKeys).toEqual([]);
  });

  it('« voirons » : radical construit sur l’infinitif → erreur de radical, blâme fut-voir', () => {
    const j = judgeConjAnswer(view, 'voirons');
    expect(j.verdict).toBe('stem');
    expect(isConjAccepted(j.verdict)).toBe(false);
    expect(j.blamedKeys).toEqual(['fut-voir']);
  });

  it('« verron » : terminaison ratée → blâme le fait de terminaison fut-nous', () => {
    const j = judgeConjAnswer(view, 'verron');
    expect(j.verdict).toBe('ending');
    expect(j.blamedKeys).toEqual(['fut-nous']);
  });
});

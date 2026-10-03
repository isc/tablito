import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import ParentOverview from '../components/ParentOverview';
import ParentSubjectDetail from '../components/ParentSubjectDetail';
// Précharge les chunks lazy touchés par ces parcours pour qu'ils se résolvent
// dans le test (même pratique que divisionJourney).
import ConjPlacementScreen from '../screens/ConjPlacementScreen';
import '../screens/ProgressScreen';
import '../screens/BadgesScreen';
import '../screens/RulesScreen';
import { LangProvider } from '../i18n/LangProvider';
import { applyLang } from '../i18n/lang';
import { MAX_FRAGILE } from '../lib/leitner';
import { createNewProfile, exportProfile, importProfile, loadProfile, saveProfile } from '../lib/storage';
import { checkBadges, visibleBadgeDefinitions } from '../lib/badges';
import type { Subject } from '../lib/hardestFacts';
import { CONJ_TENSE_BADGE_ID, unlockedConjTenses } from '../lib/conjugationComposer';
import {
  createInitialConjFacts,
  requireConjFactDef,
  resolveConjQuestion,
} from '../lib/conjugationFacts';
import { advance, boxCount, findButton as button, tapLetters, text } from './helpers/dom';
import { seedConjFromPlacement } from '../lib/conjugationPlacement';
import type { ConjFact, UserProfile } from '../types';

// Tests d'INTÉGRATION de la matière conjugaison (spec Verbito) : ce que les
// tests de la couche domaine et de l'écran de séance ne peuvent pas voir —
// la migration des profils, le masquage anglais, l'accueil à deux matières,
// le parcours placement → première séance, et la flamme de série partagée.

const TODAY = '2026-08-17';

/**
 * Laisse les imports dynamiques (lazy/Suspense) se résoudre. Plusieurs tours :
 * `lazy` enchaîne import() → setState → re-render, soit une poignée de
 * microtâches, et les timers sont figés dans ces tests.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function renderApp() {
  return render(
    <LangProvider>
      <App />
    </LangProvider>,
  );
}

function expectedOf(key: string, carrierIndex = 0): string {
  return resolveConjQuestion(requireConjFactDef(key), carrierIndex).expected;
}

/**
 * Les faits que `conjReadyProfile` laisse en boîte 1 : un de plus que le
 * plafond, pour que la séance n'ouvre aucun fait neuf (cf. plus bas). Dérivé de
 * MAX_FRAGILE — sinon un recalibrage du plafond ferait échouer, en silence et
 * dans un fichier qui ne parle pas de pacing, quatre assertions sans rapport.
 */
const CONJ_FRAGILES = ['pres-g1-nous', 'imp-il', 'pres-g1-je', 'pres-g1-tu'].slice(
  0,
  MAX_FRAGILE + 1,
);

const squash = (t: string) => t.replace(/\s+/g, '');

/**
 * Répond à la question affichée, quelle qu'elle soit : l'ordre des révisions
 * bonus est tiré au sort (`pickBonusReviewFacts`), donc le coder en dur
 * rendrait le test dépendant d'un tirage. On identifie le fait par la phrase
 * porteuse présente à l'écran, puis on tape SA réponse.
 */
function answerCurrentConj(): string {
  const shown = squash(text());
  for (const key of CONJ_FRAGILES) {
    const def = requireConjFactDef(key);
    for (let i = 0; i < def.carriers.length; i++) {
      const view = resolveConjQuestion(def, i);
      if (shown.includes(squash(view.lead))) {
        tapLetters(view.expected);
        return key;
      }
    }
  }
  throw new Error(`aucune question de conjugaison reconnue à l'écran`);
}

/** Joue la séance jusqu'au récap. Renvoie les faits posés, dans l'ordre. */
function playConjSession(): string[] {
  const asked: string[] = [];
  // Borne de sécurité : une séance de conjugaison plafonne bien en dessous.
  while (asked.length < 16 && !document.querySelector('.recap-screen')) {
    asked.push(answerCurrentConj());
    advance(2500);
  }
  return asked;
}

/** Profil dont la matière est déjà ouverte et le placement passé. */
function conjReadyProfile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.hasSeenConjIntro = true;
  p.hasDoneConjPlacement = true;
  // Un profil neuf n'a PAS de faits de conjugaison : ils sont ensemencés à la
  // première entrée dans la matière (App). Un profil « prêt » les a donc.
  p.conjFacts = createInitialConjFacts();
  p.lastSessionDate = null;
  p.lastMathSessionDate = null;
  p.lastConjSessionDate = null;
  // Assez de faits fragiles pour que `shouldIntroduceNew` refuse d'ouvrir un
  // fait neuf (plafond de 3 faits en boîte 1) : la séance se réduit alors aux
  // révisions — de quoi la jouer entière dans un test sans en faire un
  // marathon. `pres-g1-nous` est la seule due, les autres remplissent le bonus.
  p.conjFacts = (p.conjFacts ?? []).map((f): ConjFact =>
    CONJ_FRAGILES.includes(f.key)
      ? {
          ...f,
          introduced: true,
          box: 1,
          lastSeen: '2026-01-01',
          nextDue: f.key === 'pres-g1-nous' ? '2026-01-01' : '2099-12-31',
        }
      : f,
  );
  return p;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  applyLang('fr');
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  applyLang('fr');
});

describe('Migration d’un profil antérieur à la matière (spec §7.1)', () => {
  it('backfille les faits, l’image et les dates par matière, sans rien perdre', () => {
    // Profil « v3 » : aucun champ de conjugaison, une séance de maths faite
    // hier — la forme exacte qu'ont les profils déjà en production.
    const legacy = createNewProfile('Zoé');
    legacy.lastSessionDate = '2026-08-16';
    const raw = JSON.parse(exportProfile(legacy)) as Record<string, unknown>;
    delete raw.conjFacts;
    delete raw.conjMysteryTheme;
    delete raw.hasSeenConjIntro;
    delete raw.hasDoneConjPlacement;
    delete raw.lastMathSessionDate;
    delete raw.lastConjSessionDate;
    localStorage.setItem('multiplix-profile', JSON.stringify(raw));

    const migrated = loadProfile()!;

    // Les 63 faits ne sont PAS backfillés : `conjFacts` absent veut dire
    // « matière jamais commencée », et l'ensemencement attend la première
    // entrée. Seule l'image de la matière est tirée d'avance.
    expect(migrated.conjFacts).toBeUndefined();
    expect(migrated.conjMysteryTheme).toBeDefined();
    // Image propre à la matière : jamais celle d'un niveau de maths du profil.
    expect(migrated.conjMysteryTheme).not.toBe(migrated.mysteryTheme);
    expect(migrated.conjMysteryTheme).not.toBe(migrated.divisionMysteryTheme);
    expect(migrated.conjMysteryTheme).not.toBe(migrated.remainderMysteryTheme);
    expect(migrated.hasSeenConjIntro).toBe(false);
    expect(migrated.hasDoneConjPlacement).toBe(false);
    // Avant la conjugaison, toute séance était une séance de maths : sans ce
    // report, l'enfant se verrait reproposer une séance déjà faite.
    expect(migrated.lastMathSessionDate).toBe('2026-08-16');
    expect(migrated.lastConjSessionDate).toBeNull();
  });

  it('l’export/import préserve l’état de la matière (sauvegarde, QR, transfert)', () => {
    const p = conjReadyProfile();
    p.conjFacts = p.conjFacts!.map((f) =>
      f.key === 'pres-g1-nous' ? { ...f, box: 4 as const } : f,
    );

    const restored = importProfile(exportProfile(p))!;

    expect(restored).not.toBeNull();
    expect(restored.conjFacts).toHaveLength(63);
    expect(restored.conjFacts!.find((f) => f.key === 'pres-g1-nous')!.box).toBe(4);
    expect(restored.hasDoneConjPlacement).toBe(true);
    expect(restored.conjMysteryTheme).toBe(p.conjMysteryTheme);
  });

  it('un JSON dont les faits de conjugaison sont malformés est refusé', () => {
    const p = conjReadyProfile();
    const raw = JSON.parse(exportProfile(p)) as Record<string, unknown>;
    raw.conjFacts = [{ key: '', box: 9, introduced: 'oui' }];
    expect(importProfile(JSON.stringify(raw))).toBeNull();
  });
});

describe('Accueil multi-matières (spec §9)', () => {
  it('en français : deux tuiles, et une pastille de découverte sur la conjugaison', () => {
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    p.lastSessionDate = null;
    saveProfile(p);

    renderApp();

    expect(button(/Maths/)).not.toBeNull();
    expect(button(/Conjugaison/)).not.toBeNull();
    // Révélation différée : une pastille, jamais une modale.
    expect(document.querySelector('.home-subject-dot')).not.toBeNull();
    expect(document.querySelector('.welcome-title')).toBeNull();
  });

  it('la pastille s’éteint dès que la matière a été ouverte', () => {
    const p = conjReadyProfile();
    saveProfile(p);

    renderApp();

    expect(button(/Conjugaison/)).not.toBeNull();
    expect(document.querySelector('.home-subject-dot')).toBeNull();
  });

  it('en anglais : aucune trace de la matière, l’accueil est celui d’avant', () => {
    const p = conjReadyProfile();
    // Même un profil qui a DÉJÀ joué la matière : en anglais, rien ne sort.
    saveProfile(p);
    applyLang('en');

    renderApp();

    expect(text()).not.toMatch(/Conjugaison|Conjugation/);
    expect(document.querySelector('.home-subjects')).toBeNull();
    expect(document.querySelector('.home-subject-dot')).toBeNull();
    // Le bouton unique d'origine est de retour.
    expect(button(/Let's go/)).not.toBeNull();
  });

  it('les badges de la matière sont masqués en anglais, visibles en français', () => {
    const p = conjReadyProfile();

    applyLang('fr');
    const frIds = visibleBadgeDefinitions(p).map((d) => d.id);
    expect(frIds).toContain(CONJ_TENSE_BADGE_ID.present);
    expect(frIds.filter((id) => id.startsWith('conj-verbe-'))).toHaveLength(7);

    applyLang('en');
    const enIds = visibleBadgeDefinitions(p).map((d) => d.id);
    expect(enIds.some((id) => id.startsWith('conj-'))).toBe(false);
  });

  it('les badges restent masqués tant que la matière n’a jamais été ouverte', () => {
    const p = createNewProfile('Zoé');
    expect(visibleBadgeDefinitions(p).some((d) => d.id.startsWith('conj-'))).toBe(false);
  });
});

describe('Écran « Mes règles » : les règles de la matière (spec §15.3)', () => {
  async function openRules(): Promise<void> {
    fireEvent.click(button(/^(Règles|Rules)/)!);
    await flush();
  }

  const textsOf = (selector: string) =>
    Array.from(document.querySelectorAll(selector), (el) => el.textContent);

  /** L'écran d'avant la conjugaison : les seules règles de maths, sans onglets. */
  function expectMathsOnly(rule10Heading: string): void {
    expect(text()).toContain(rule10Heading);
    expect(textsOf('.rules-content > .parent-segmented button')).toEqual([]);
    expect(textsOf('.rule-card-conj')).toEqual([]);
  }

  it('matière ouverte : les règles rencontrées, après celles des maths', async () => {
    // Du présent, dont « nous mangeons », et un imparfait — aucun futur.
    const met = ['pres-g1-je', 'pres-g1-nous', 'imp-il'];
    const p = conjReadyProfile();
    p.conjFacts = createInitialConjFacts().map((f) => (met.includes(f.key) ? { ...f, introduced: true } : f));
    saveProfile(p);
    renderApp();
    await openRules();

    // Deux onglets, les maths d'abord : les règles de conjugaison attendent
    // qu'on ouvre le leur.
    expect(textsOf('.rules-content > .parent-segmented button')).toEqual(['Maths', 'Conjugaison']);
    expect(text()).toContain('Multiplier par 10');
    expect(textsOf('.rule-card-conj')).toEqual([]);

    fireEvent.click(button(/^Conjugaison$/)!);
    await flush();
    expect(text()).not.toContain('Multiplier par 10');
    expect(textsOf('.rule-card-conj .rule-card-heading')).toEqual([
      'Chaque personne a sa marque',
      'L’imparfait se fabrique avec « nous »',
      'Le piège du g et du c',
    ]);
    // Le futur n'a pas encore été abordé : sa règle attend son premier fait.
    expect(text()).not.toContain('Le futur se fabrique');
    // Chaque règle : ses blocs en entier (l'écran ne coupe pas au cœur de
    // la séance), et un bouton « Écouter ».
    expect(text()).toContain('Les 4 rebelles');
    expect(text()).toContain('Les 6 terminaisons');
    expect(document.querySelectorAll('.rule-card-conj [aria-label="Écouter la règle"]')).toHaveLength(3);
  });

  it('matière ouverte mais aucun fait encore rencontré : l’écran d’avant', async () => {
    const p = conjReadyProfile();
    p.conjFacts = createInitialConjFacts();
    saveProfile(p);
    renderApp();
    await openRules();

    expectMathsOnly('Multiplier par 10');
  });

  it('matière jamais ouverte : rien de la conjugaison', async () => {
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    saveProfile(p);
    renderApp();
    await openRules();

    expectMathsOnly('Multiplier par 10');
  });

  it('en anglais : les seules règles de maths, même pour un profil qui a joué la matière', async () => {
    saveProfile(conjReadyProfile());
    applyLang('en');
    renderApp();
    await openRules();

    expectMathsOnly('Multiply by 10');
  });
});

describe('Déblocages par badges permanents (spec §6.2)', () => {
  it('le présent maîtrisé décerne son badge, qui ouvre l’imparfait', () => {
    const p = conjReadyProfile();
    // Tout le présent en boîte 5 ; le reste intouché.
    p.conjFacts = p.conjFacts!.map((f) =>
      f.key.startsWith('pres-') ? { ...f, introduced: true, box: 5 as const } : f,
    );

    expect(unlockedConjTenses(p.badges)).toEqual(['present']);

    const earned = checkBadges(p, { consecutiveCorrect: 0, wasFast: [] }, null);
    const ids = earned.map((b) => b.id);
    expect(ids).toContain(CONJ_TENSE_BADGE_ID.present);
    expect(ids).not.toContain(CONJ_TENSE_BADGE_ID.imparfait);

    // Le déblocage repose sur le badge, pas sur l'état Leitner en direct : une
    // mauvaise journée qui refait tomber des faits ne referme pas le temps.
    const withBadge: UserProfile = { ...p, badges: earned };
    expect(unlockedConjTenses(withBadge.badges)).toEqual(['present', 'imparfait']);
    const afterBadDay: UserProfile = {
      ...withBadge,
      conjFacts: withBadge.conjFacts!.map((f) => ({ ...f, box: 1 as const })),
    };
    expect(unlockedConjTenses(afterBadDay.badges)).toEqual(['present', 'imparfait']);
  });
});

describe('Parcours : première ouverture → placement → première séance (spec §6.1)', () => {
  it('la tuile Conjugaison mène au test de placement, puis à la séance', async () => {
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    p.lastSessionDate = null;
    saveProfile(p);

    renderApp();
    fireEvent.click(button(/Conjugaison/)!);
    await flush();

    // Écran de placement : une invitation, pas un examen.
    expect(text()).toContain('On regarde ce que tu sais déjà');
    fireEvent.click(button(/On y va/)!);

    // Arrêt après 3 échecs consécutifs : « Je ne sais pas » trois fois suffit.
    for (let i = 0; i < 3; i++) {
      fireEvent.click(button(/Je ne sais pas/)!);
      advance(1500);
    }

    // Aucune sonde réussie ⇒ rien n'a été ensemencé : on n'affiche PAS le
    // « regarde tout ce que tu sais déjà », qui serait un compliment creux.
    expect(text()).toContain('On va tout découvrir ensemble');
    expect(text()).not.toContain('Regarde tout ce que tu sais déjà');
    fireEvent.click(button(/Commencer ma séance/)!);
    await flush();

    // On est bien entré en séance de conjugaison (écran d'introduction d'un
    // fait neuf : le placement n'a rien ensemencé, tout est à découvrir).
    expect(document.querySelector('.conj-intro')).not.toBeNull();

    // Le passage par la tuile a ouvert la matière (pastille éteinte, onglets
    // transverses désormais visibles).
    expect(loadProfile()!.hasSeenConjIntro).toBe(true);
    expect(loadProfile()!.hasDoneConjPlacement).toBe(true);
  });

  it('le placement juge comme la séance : la forme entière tapée reste juste', () => {
    // Sonde 1 : « En ce moment, nous chant____ ». L'enfant qui tape la forme
    // entière a compris la question — c'est le malentendu de consigne que
    // `judgeConjAnswer` excuse explicitement en séance (§4.5). Le placement ne
    // peut pas être plus sévère que le jeu : chaque faux échec rapproche de
    // l'arrêt à 3 échecs, sur le premier geste de réassurance de la matière.
    render(
      <LangProvider>
        <ConjPlacementScreen onComplete={() => {}} />
      </LangProvider>,
    );
    fireEvent.click(button(/On y va/)!);

    tapLetters('chantons');

    expect(document.querySelector('.welcome-test-feedback.correct')).not.toBeNull();
    expect(document.querySelector('.welcome-test-feedback.incorrect')).toBeNull();
  });

  it('un placement réussi ensemence les boîtes — l’image démarre déjà révélée', () => {
    // Un profil neuf n'a pas encore de faits : c'est l'entrée dans la matière
    // qui les ensemence, tous non introduits.
    const p = createNewProfile('Zoé');
    expect(p.conjFacts).toBeUndefined();
    const fresh = createInitialConjFacts();
    expect(fresh.filter((f) => f.introduced)).toHaveLength(0);

    // On rejoue le geste du placement sur la couche domaine (l'écran, lui, est
    // couvert ci-dessus) : réussir « vous parlerez » démontre la règle du futur.
    const seeded = { ...p, conjFacts: fresh };
    seedConjFromPlacement(
      seeded.conjFacts,
      [{ key: 'fut-vous', correct: true, timeMs: 1000 }],
      TODAY,
    );
    expect(seeded.conjFacts.filter((f) => f.introduced).length).toBeGreaterThan(1);
  });
});

describe('Espace parent — la matière conjugaison (spec §8, §11)', () => {
  function renderSubject(p: UserProfile, subject: Subject) {
    return render(
      <LangProvider>
        <ParentSubjectDetail profile={p} subject={subject} />
      </LangProvider>,
    );
  }

  function renderOverview(p: UserProfile, onOpenSubject: (s: Subject) => void = () => {}) {
    return render(
      <LangProvider>
        <ParentOverview profile={p} onOpenSubject={onOpenSubject} />
      </LangProvider>,
    );
  }

  // Une séance de conjugaison ratée sur « nous mangeons ».
  function withConjMistake(p: UserProfile): UserProfile {
    p.sessionHistory = [
      {
        kind: 'conj',
        date: TODAY,
        questionsCount: 2,
        correctCount: 1,
        averageTimeMs: 3000,
        newFactsIntroduced: 0,
        factsPromoted: 0,
        questions: [
          {
            kind: 'conj',
            // Ni `a` ni `b` : un fait de conjugaison n'est pas indexé par un
            // couple de nombres, c'est `factKey` qui l'identifie.
            factKey: 'pres-g1-nous',
            correct: false,
            responseTimeMs: 4000,
            answeredWith: null,
            isBonusReview: false,
            inputMode: 'keypad',
          },
        ],
      },
    ];
    return p;
  }

  it('l’accueil a une carte Conjugaison, qui ouvre la page de la matière', () => {
    const open = vi.fn();
    renderOverview(conjReadyProfile(), open);

    const card = document.querySelector<HTMLButtonElement>('.parent-subject-card--conj');
    expect(card?.textContent).toContain('Conjugaison');
    expect(card?.querySelector('.parent-level-count')?.textContent).toBe('0 / 63');
    fireEvent.click(card!);
    expect(open).toHaveBeenCalledWith('conj');
  });

  it('la page Conjugaison montre la maîtrise et la grille 8×8 de la matière', () => {
    renderSubject(conjReadyProfile(), 'conj');

    expect(text()).toContain('Formes verbales maîtrisées');
    // Un seul niveau : pas de sélecteur.
    expect(document.querySelector('.parent-segmented')).toBeNull();
    // Grille sans en-têtes : 64 cases, aucune gouttière de numéros de table.
    expect(document.querySelector('.progress-grid--plain')).not.toBeNull();
    expect(document.querySelectorAll('.progress-grid-cell')).toHaveLength(64);
    expect(document.querySelectorAll('.progress-grid-header')).toHaveLength(0);
    // Répartition par boîte : les 63 faits y sont — les fragiles du fixture en
    // boîte 1, tout le reste pas encore vu.
    expect(boxCount(1)).toBe(CONJ_FRAGILES.length);
    expect(boxCount(0)).toBe(63 - CONJ_FRAGILES.length);
    expect(boxCount(4) + boxCount(5)).toBe(0);
  });

  it('les faits difficiles de la matière sont sur sa page, pas sur celle des maths', () => {
    const p = withConjMistake(conjReadyProfile());
    renderSubject(p, 'math');
    expect(text()).not.toContain('nous mangeons');
    cleanup();

    renderSubject(p, 'conj');
    expect(text()).toContain('À retravailler');
    expect(text()).toContain('nous mangeons');
  });

  it('l’accueil mêle les deux matières dans « À retravailler »', () => {
    renderOverview(withConjMistake(conjReadyProfile()));
    expect(text()).toContain('À retravailler');
    expect(text()).toContain('nous mangeons');
  });

  it('une forme difficile montre les dernières réponses fausses à côté de la forme attendue', () => {
    const p = withConjMistake(conjReadyProfile());
    const [old] = p.sessionHistory[0].questions!;
    // Deux erreurs enregistrées après l'ancienne (null, antérieure à
    // l'enregistrement des réponses) : la plus récente d'abord.
    p.sessionHistory[0].questions!.push(
      { ...old, answeredWith: 'mangons', expectedForm: 'mangeons' },
      { ...old, answeredWith: 'manjons', expectedForm: 'mangeons' },
    );
    renderSubject(p, 'conj');

    expect(document.querySelector('.parent-hard-fact-mistakes')?.textContent).toBe(
      'Écrit : « manjons » au lieu de « mangeons » · « mangons » au lieu de « mangeons »',
    );
  });

  it('sans réponse enregistrée (profil ancien), la forme difficile reste affichée seule', () => {
    renderSubject(withConjMistake(conjReadyProfile()), 'conj');
    expect(text()).toContain('nous mangeons');
    expect(document.querySelector('.parent-hard-fact-mistakes')).toBeNull();
  });

  it('en anglais, la matière n’apparaît nulle part dans l’espace parent', () => {
    const p = withConjMistake(conjReadyProfile());
    applyLang('en');
    renderOverview(p);

    expect(document.querySelector('.parent-subject-card--conj')).toBeNull();
    expect(text()).not.toMatch(/Conjugation|Verb forms|nous mangeons/);
  });
});

describe('Leitner de la matière (spec §4.5, §5.3)', () => {
  it('un « presque » tapé vite est accepté, mais ne fait PAS monter la boîte', () => {
    // « Demain, je serai en vacances. » tapé « cerai » : coquille lexicale,
    // acceptée sans commentaire — et l'écran affiche une étoile SANS rayons.
    // La boîte doit suivre l'écran : promouvoir ici, ce serait consolider une
    // forme que l'enfant n'a pas su écrire.
    const p = conjReadyProfile();
    p.conjFacts = p.conjFacts!.map((f): ConjFact => {
      if (f.key === 'fut-etre') {
        return { ...f, introduced: true, box: 1, lastSeen: '2026-01-01', nextDue: '2026-01-01' };
      }
      // Les autres faits introduits ne sont plus dus : la séance s'ouvre à coup
      // sûr sur « fut-etre ».
      return f.introduced ? { ...f, nextDue: '2099-12-31' } : f;
    });
    saveProfile(p);

    renderApp();
    fireEvent.click(button(/Conjugaison/)!);

    expect(expectedOf('fut-etre')).toBe('serai');
    tapLetters('cerai');

    const fact = loadProfile()!.conjFacts!.find((f) => f.key === 'fut-etre')!;
    // `seen` prouve que la réponse a bien été enregistrée (sans quoi la boîte
    // inchangée ne voudrait rien dire) : le fait a été posé une fois.
    expect(fact.seen).toBe(1);
    expect(fact.box).toBe(1);
    expect(document.querySelector('.feedback-star-rays')).toBeNull();
  });
});

describe('Réponse écrite de conjugaison : enregistrée comme en calcul', () => {
  it('la forme écrite et la forme attendue vont dans l’historique du fait et dans le log de la séance', async () => {
    // Retour 0aa1c434 : `answeredWith` restait à null en conjugaison, et un
    // futur « je » raté 15 fois ne disait pas QUELLE erreur l'enfant faisait.
    saveProfile(conjReadyProfile());
    renderApp();
    fireEvent.click(button(/Conjugaison/)!);
    await flush();

    // « nous man|geons » : le radical est donné, l'enfant tape « ez ». C'est la
    // forme lue à l'écran, radical compris, qu'on garde — « ez » seul ne dirait
    // rien sans le verbe de la phrase porteuse.
    expect(expectedOf('pres-g1-nous')).toBe('geons');
    tapLetters('ez');
    fireEvent.click(button(/J'ai compris/)!);
    playConjSession();
    expect(document.querySelector('.recap-screen')).not.toBeNull();

    const saved = loadProfile()!;
    const history = saved.conjFacts!.find((f) => f.key === 'pres-g1-nous')!.history;
    expect(history.find((h) => !h.correct)).toMatchObject({
      answeredWith: 'manez',
      expectedForm: 'mangeons',
    });
    // La bonne réponse du re-test est enregistrée elle aussi.
    expect(history.find((h) => h.correct)).toMatchObject({
      answeredWith: 'mangeons',
      expectedForm: 'mangeons',
    });

    const logs = saved.sessionHistory[0].questions!;
    expect(logs[0]).toMatchObject({
      kind: 'conj',
      factKey: 'pres-g1-nous',
      correct: false,
      answeredWith: 'manez',
      expectedForm: 'mangeons',
    });
    expect(logs.every((q) => typeof q.answeredWith === 'string' && q.expectedForm)).toBe(true);
  });
});

describe('Séance de conjugaison : flamme partagée, matières indépendantes (spec §7.2)', () => {
  it('une séance de conjugaison entretient la série sans fermer la séance de maths', async () => {
    saveProfile(conjReadyProfile());

    renderApp();
    fireEvent.click(button(/Conjugaison/)!);
    await flush();

    // La révision due, puis les révisions bonus, jusqu'au récap.
    const asked = playConjSession();
    expect(asked[0]).toBe('pres-g1-nous'); // la due passe avant les bonus
    expect(asked.length).toBeGreaterThan(1);

    // Récap de la matière : message chaleureux, jauge en « formes verbales »,
    // aucun score ni compte d'erreurs (§5.3).
    expect(document.querySelector('.recap-screen')).not.toBeNull();
    expect(text()).toContain('formes verbales');
    // La réponse était juste et rapide ⇒ montée de boîte ⇒ et SEULEMENT dans
    // ce cas, l'annonce que l'image a changé (§10 du périmètre).
    expect(document.querySelector('.recap-image-link')).not.toBeNull();

    const saved = loadProfile()!;
    // Flamme de série : partagée, une séance quelconque la maintient.
    expect(saved.lastSessionDate).toBe(TODAY);
    expect(saved.currentStreak).toBe(1);
    // Séance du jour : la conjugaison est faite, les maths NON.
    expect(saved.lastConjSessionDate).toBe(TODAY);
    expect(saved.lastMathSessionDate).toBeNull();

    // Le lien du récap ouvre l'image de la MATIÈRE — une seule image pour les
    // trois temps, 8×8 (§7.1) — pas celle d'un niveau de maths.
    fireEvent.click(document.querySelector<HTMLButtonElement>('.recap-image-link')!);
    await flush();
    expect(document.querySelector('.progress-tab.active')?.textContent).toBe('Conjugaison');
    expect(document.querySelectorAll('.mystery-cell')).toHaveLength(64);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.progress-back-btn')!);

    // De retour à l'accueil : la tuile Maths reste jouable, celle de la
    // conjugaison affiche son ✓ tranquille.
    const maths = button(/Maths/)!;
    const conj = button(/Conjugaison/)!;
    expect(maths.disabled).toBe(false);
    expect(conj.disabled).toBe(true);
    expect(conj.className).toContain('is-done');
  });
});

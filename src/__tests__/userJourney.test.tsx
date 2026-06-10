import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { getCompletedTables } from '../lib/badges';
import { loadProfile } from '../lib/storage';
import { BADGE_IDS } from '../types';
// Préchauffe le chunk de ParentDashboard pour que le React.lazy() côté App.tsx
// se résolve en synchrone dans les tests qui ouvrent le dashboard.
import '../screens/ParentDashboard';

// ---------------------------------------------------------------------------
// Test d'intégration « bout en bout » qui monte le vrai composant <App />
// dans jsdom et pilote l'app uniquement via des interactions DOM réelles
// (clics sur les boutons du NumPad, saisie du prénom, dismissal des overlays,
// etc.). Aucun helper ne duplique la logique d'App.tsx — tout passe par le
// wiring React de production.
// ---------------------------------------------------------------------------

const START_DATE = new Date('2026-01-05T08:00:00.000Z');
const QUESTION_RE = /(\d+)\D+(\d+)/;

// PRNG déterministe (mulberry32) pour rendre les simulations reproductibles.
// La sélection de session et l'ordre d'affichage utilisent Math.random ; sans
// graine fixe, la convergence vers la maîtrise dans le plafond de 365 jours
// n'est pas garantie (flake CI). Avec une graine, le parcours est stable.
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setDay(offset: number): void {
  const d = new Date(START_DATE);
  d.setUTCDate(d.getUTCDate() + offset);
  vi.setSystemTime(d);
}

function findButton(label: RegExp | string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('button'));
  return (
    (buttons.find((b) => {
      const text = (b.textContent ?? '').trim();
      return typeof label === 'string' ? text === label : label.test(text);
    }) as HTMLButtonElement | null) ?? null
  );
}

function readCurrentQuestion(): [number, number] | null {
  const el = document.querySelector('.session-question-text');
  if (!el) return null;
  const text = el.textContent ?? '';
  const match = text.match(QUESTION_RE);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function readPlacementQuestion(): [number, number] | null {
  const el = document.querySelector('.welcome-test-question');
  if (!el) return null;
  const text = el.textContent ?? '';
  const match = text.match(QUESTION_RE);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function typeAnswer(value: number): void {
  const digits = value.toString();
  for (const d of digits) {
    const btn = document.querySelector<HTMLButtonElement>(
      `.numpad-btn[aria-label="${d}"]`,
    );
    if (!btn) throw new Error(`NumPad button ${d} introuvable`);
    fireEvent.click(btn);
  }
  if (digits.length === 1) {
    const okBtn = findButton('OK');
    if (!okBtn) throw new Error('Bouton OK introuvable après saisie 1 chiffre');
    fireEvent.click(okBtn);
  }
}

// Joue les 15 questions du test de placement, toutes correctes et rapides
// (boîte 3 pour les directs, boîte 2 pour les inférés par dominance).
function playPlacementAllCorrect(): void {
  for (let i = 0; i < 15; i++) {
    const q = readPlacementQuestion();
    if (!q) throw new Error(`Question de placement ${i + 1} introuvable`);
    typeAnswer(q[0] * q[1]);
    // Le feedback bref est dismissé via setTimeout (600 ms si correct).
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }
}

/**
 * Joue une séance du début à la fin puis clique « À demain ! » pour
 * revenir à l'écran d'accueil. Pilote le vrai DOM : introductions,
 * saisie NumPad, dismissal du feedback, et recap.
 *
 * `shouldErr(answerIdx)` permet d'injecter des erreurs déterministes :
 * quand il renvoie true, on tape `correct - 1` au lieu de `correct`.
 */
function playSessionAndDismissRecap(opts: { shouldErr?: (answerIdx: number) => boolean } = {}): void {
  const MAX_ITERS = 2000;
  let answerIdx = 0;

  for (let i = 0; i < MAX_ITERS; i++) {
    // Priorité aux états les plus fréquents pour limiter les scans DOM.

    const feedback = document.querySelector<HTMLElement>('.feedback-overlay');
    if (feedback) {
      // Correct overlay dismisses sur clic global ; incorrect exige le
      // bouton « J'ai compris » (l'overlay incorrect montre la stratégie
      // et la grille, pas de dismiss-on-tap).
      if (feedback.classList.contains('incorrect')) {
        const okBtn = findButton(/J'ai compris/);
        if (!okBtn) throw new Error('Bouton « J\'ai compris » introuvable sur feedback incorrect');
        fireEvent.click(okBtn);
      } else {
        fireEvent.click(feedback);
      }
      continue;
    }

    const question = readCurrentQuestion();
    if (question) {
      const [a, b] = question;
      const correct = a * b;
      const wantWrong = opts.shouldErr?.(answerIdx) ?? false;
      // `correct - 1` est toujours > 0 (a, b >= 2 donc correct >= 4) et
      // toujours différent du bon produit → garanti faux.
      typeAnswer(wantWrong ? correct - 1 : correct);
      answerIdx++;
      continue;
    }

    if (document.querySelector('.session-intro')) {
      const next = findButton(/^Suivant/) ?? findButton(/J'ai compris/);
      if (next) {
        fireEvent.click(next);
        continue;
      }
    }

    // Terminal : écran Recap visible → on le ferme pour revenir à Home.
    const recapBtn = findButton(/À demain/);
    if (recapBtn) {
      fireEvent.click(recapBtn);
      return;
    }

    throw new Error(
      'playSession: état DOM inattendu (ni feedback, ni question, ni intro, ni recap)',
    );
  }

  throw new Error('playSession: MAX_ITERS dépassé — boucle probable');
}

// Ouvre le dashboard parent depuis Home : clique l'icône engrenage, résout
// la multiplication aléatoire du ParentGate, puis attend le chunk lazy.
async function openParentDashboard(): Promise<void> {
  fireEvent.click(document.querySelector<HTMLButtonElement>('.home-parent-btn')!);
  const question = document.querySelector('.parent-gate-question');
  if (!question) throw new Error('ParentGate non affiché');
  const operands = Array.from(question.querySelectorAll('span'))
    .map((s) => parseInt(s.textContent ?? '', 10))
    .filter((n) => Number.isFinite(n));
  if (operands.length < 2) throw new Error('Opérandes du ParentGate introuvables');
  const product = operands[0] * operands[1];
  const input = document.querySelector<HTMLInputElement>('.parent-gate-input')!;
  fireEvent.change(input, { target: { value: String(product) } });
  fireEvent.click(findButton('Valider')!);
  // ParentDashboard est chargé via React.lazy → on flushe plusieurs ticks
  // microtask pour que le chunk dynamique se résolve et que la Suspense
  // rende. `act(async)` seul ne suffit pas avec les fake timers.
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('Parcours utilisateur de bout en bout (DOM)', () => {
  beforeEach(() => {
    localStorage.clear();
    // La landing PWA s'intercale avant WelcomeScreen sur une fresh install.
    // Ce test cible le parcours d'apprentissage, pas l'install ; on saute
    // directement comme le ferait un parent qui clique « Essayer dans le
    // navigateur ».
    localStorage.setItem('multiplix-skip-install', '1');
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(1));
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    setDay(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it(
    "mène Zoé de la première utilisation à la maîtrise des 36 faits",
    () => {
      render(<App />);

      // -- 1. WelcomeScreen affiché (pas de profil en storage) --
      expect(loadProfile()).toBeNull();
      expect(findButton(/^Suivant/)).not.toBeNull();

      // -- 2. Parcours de bienvenue --
      fireEvent.click(findButton(/^Suivant/)!);

      const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
      fireEvent.change(nameInput, { target: { value: 'Zoe' } });
      fireEvent.click(findButton(/^C'est moi/)!);

      fireEvent.click(findButton('Passer le test')!);

      // -- RulesIntroScreen (3 étapes : intro, règle ×1, règle ×10) --
      fireEvent.click(findButton(/C'est parti/)!);
      fireEvent.click(findButton(/Suivant/)!);
      fireEvent.click(findButton(/J'ai compris/)!);

      expect(findButton(/C'est parti/)).not.toBeNull();

      const initial = loadProfile()!;
      expect(initial.facts).toHaveLength(36);
      expect(initial.facts.every((f) => f.box === 1)).toBe(true);
      expect(initial.facts.every((f) => !f.introduced)).toBe(true);
      expect(initial.badges).toHaveLength(0);

      // -- 3. Boucle quotidienne jusqu'à maîtrise complète --
      const MAX_DAYS = 365;
      let sessionsPlayed = 0;
      let day = 0;

      while (day < MAX_DAYS) {
        const profile = loadProfile()!;
        if (profile.facts.every((f) => f.box === 5)) break;

        setDay(day);

        // Remonte l'app (= l'enfant rouvre l'app le lendemain).
        if (day > 0) {
          cleanup();
          render(<App />);
        }

        const startBtn = findButton(/C'est parti/);
        if (!startBtn) {
          day++;
          continue;
        }

        fireEvent.click(startBtn);

        // composeSession peut retourner 0 questions ; dans ce cas App
        // reste sur Home et il ne faut pas entrer dans playSession.
        const sessionStarted =
          document.querySelector('.session-intro') !== null ||
          document.querySelector('.session-question-text') !== null;

        if (!sessionStarted) {
          day++;
          continue;
        }

        playSessionAndDismissRecap();
        sessionsPlayed++;
        day++;
      }

      // -- 4. Assertions finales --
      expect(day).toBeLessThan(MAX_DAYS);
      expect(sessionsPlayed).toBeGreaterThan(0);

      const final = loadProfile()!;
      expect(final.facts.every((f) => f.box === 5)).toBe(true);
      expect(final.facts.every((f) => f.introduced)).toBe(true);
      expect(final.totalSessions).toBe(sessionsPlayed);

      const completedTables = getCompletedTables(final.facts);
      for (let t = 2; t <= 9; t++) {
        expect(completedTables.has(t)).toBe(true);
      }

      const badgeIds = new Set(final.badges.map((b) => b.id));
      expect(badgeIds.has(BADGE_IDS.PREMIER_PAS)).toBe(true);
      expect(badgeIds.has(BADGE_IDS.PREMIERE_CASE)).toBe(true);
      expect(badgeIds.has(BADGE_IDS.PREMIERE_MAITRISE)).toBe(true);
      expect(badgeIds.has(BADGE_IDS.EXPLORATION)).toBe(true);
      expect(badgeIds.has(BADGE_IDS.GENIE_MATHS)).toBe(true);
      for (let t = 2; t <= 9; t++) {
        expect(badgeIds.has(`${BADGE_IDS.TABLE_PREFIX}${t}`)).toBe(true);
      }
    },
  );

  it(
    "passe par le test de placement et atteint la maîtrise même avec des erreurs occasionnelles",
    () => {
      render(<App />);

      // -- WelcomeScreen + saisie prénom --
      fireEvent.click(findButton(/^Suivant/)!);
      const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
      fireEvent.change(nameInput, { target: { value: 'Zoe' } });
      fireEvent.click(findButton(/^C'est moi/)!);

      // -- Test de placement : 15 questions, toutes correctes rapides --
      // Lance le placement (et non « Passer le test »). Le bouton « C'est
      // parti ! » et « Passer le test » coexistent à cet écran.
      fireEvent.click(findButton(/C'est parti/)!);
      playPlacementAllCorrect();

      // -- RulesIntroScreen --
      fireEvent.click(findButton(/C'est parti/)!);
      fireEvent.click(findButton(/Suivant/)!);
      fireEvent.click(findButton(/J'ai compris/)!);

      const seeded = loadProfile()!;
      // Le seeding par dominance doit avoir introduit 34 faits sur 36
      // (8×9 et 9×9 ne sont dominés par aucun fait du set placement).
      expect(seeded.facts.filter((f) => f.introduced)).toHaveLength(34);
      expect(seeded.facts.find((f) => f.a === 8 && f.b === 9)?.introduced).toBe(false);
      expect(seeded.facts.find((f) => f.a === 9 && f.b === 9)?.introduced).toBe(false);

      // -- Boucle quotidienne avec erreurs : ~14 % d'erreurs (1/7) --
      // Garantit qu'au moins un fait est en boîte 1 régulièrement, ce qui
      // exerce le chemin où shouldIntroduceNew se bloquerait sans
      // l'exception « phase finale » pour 8×9 et 9×9.
      const shouldErr = (i: number) => i % 7 === 6;
      const MAX_DAYS = 365;
      let day = 0;
      let sessionsPlayed = 0;

      while (day < MAX_DAYS) {
        const profile = loadProfile()!;
        if (profile.facts.every((f) => f.box === 5)) break;

        setDay(day);
        if (day > 0) {
          cleanup();
          render(<App />);
        }

        const startBtn = findButton(/C'est parti/);
        if (!startBtn) {
          day++;
          continue;
        }
        fireEvent.click(startBtn);

        const sessionStarted =
          document.querySelector('.session-intro') !== null ||
          document.querySelector('.session-question-text') !== null;
        if (!sessionStarted) {
          day++;
          continue;
        }

        playSessionAndDismissRecap({ shouldErr });
        sessionsPlayed++;
        day++;
      }

      const final = loadProfile()!;
      // Tous les faits doivent finir introduits — le bug 8×9/9×9 doit
      // être empêché par l'exception « phase finale ».
      expect(final.facts.every((f) => f.introduced)).toBe(true);
      expect(final.facts.every((f) => f.box === 5)).toBe(true);
      expect(day).toBeLessThan(MAX_DAYS);
      expect(sessionsPlayed).toBeGreaterThan(0);
    },
  );

  it("le bouton « Réinitialiser le profil » efface le profil et relance le test de placement", async () => {
    render(<App />);

    // Setup minimal : on crée un profil en sautant le test de placement.
    fireEvent.click(findButton(/^Suivant/)!);
    const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
    fireEvent.change(nameInput, { target: { value: 'Zoe' } });
    fireEvent.click(findButton(/^C'est moi/)!);
    fireEvent.click(findButton('Passer le test')!);
    fireEvent.click(findButton(/C'est parti/)!);
    fireEvent.click(findButton(/Suivant/)!);
    fireEvent.click(findButton(/J'ai compris/)!);
    expect(loadProfile()).not.toBeNull();

    await openParentDashboard();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(findButton('Réinitialiser le profil')!);
    confirmSpy.mockRestore();

    expect(loadProfile()).toBeNull();
    // On est revenu sur WelcomeScreen (saisie du prénom à nouveau possible).
    expect(findButton(/^Suivant/)).not.toBeNull();
  });

  it("annuler la confirmation n'efface PAS le profil", async () => {
    render(<App />);

    fireEvent.click(findButton(/^Suivant/)!);
    const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
    fireEvent.change(nameInput, { target: { value: 'Zoe' } });
    fireEvent.click(findButton(/^C'est moi/)!);
    fireEvent.click(findButton('Passer le test')!);
    fireEvent.click(findButton(/C'est parti/)!);
    fireEvent.click(findButton(/Suivant/)!);
    fireEvent.click(findButton(/J'ai compris/)!);
    const before = loadProfile();
    expect(before).not.toBeNull();

    await openParentDashboard();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(findButton('Réinitialiser le profil')!);
    confirmSpy.mockRestore();

    expect(loadProfile()?.name).toBe(before!.name);
  });

  it("arrête le test de placement après 3 ratés consécutifs", () => {
    render(<App />);

    fireEvent.click(findButton(/^Suivant/)!);
    const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
    fireEvent.change(nameInput, { target: { value: 'Zoe' } });
    fireEvent.click(findButton(/^C'est moi/)!);
    fireEvent.click(findButton(/C'est parti/)!);

    // 3 « Je ne sais pas » consécutifs dès le début du test.
    for (let i = 0; i < 3; i++) {
      const dontKnow = findButton(/Je ne sais pas/);
      expect(dontKnow, `« Je ne sais pas » introuvable à la question ${i + 1}`).not.toBeNull();
      fireEvent.click(dontKnow!);
      act(() => {
        vi.advanceTimersByTime(1200);
      });
    }

    // Le test doit s'être arrêté → on est passé sur RulesIntroScreen
    // (3 étapes : accueil, règle ×1, règle ×10).
    expect(findButton(/C'est parti/)).not.toBeNull();
    expect(document.querySelector('.welcome-test-question')).toBeNull();
  });
});

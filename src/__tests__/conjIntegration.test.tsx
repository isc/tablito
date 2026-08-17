import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import ParentStats from '../components/ParentStats';
// Précharge les chunks lazy touchés par ces parcours pour qu'ils se résolvent
// dans le test (même pratique que divisionJourney).
import '../screens/ConjPlacementScreen';
import '../screens/ProgressScreen';
import '../screens/BadgesScreen';
import { LangProvider } from '../i18n/LangProvider';
import { applyLang } from '../i18n/lang';
import { createNewProfile, exportProfile, importProfile, loadProfile, saveProfile } from '../lib/storage';
import { checkBadges, visibleBadgeDefinitions } from '../lib/badges';
import { CONJ_TENSE_BADGE_ID, unlockedConjTenses } from '../lib/conjugationComposer';
import { requireConjFactDef, resolveConjQuestion } from '../lib/conjugationFacts';
import { seedConjFromPlacement } from '../lib/conjugationPlacement';
import type { ConjFact, UserProfile } from '../types';

// Tests d'INTÉGRATION de la matière conjugaison (spec Verbito) : ce que les
// tests de la couche domaine et de l'écran de séance ne peuvent pas voir —
// la migration des profils, le masquage anglais, l'accueil à deux matières,
// le parcours placement → première séance, et la flamme de série partagée.

const TODAY = '2026-08-17';

function text(): string {
  return document.body.textContent ?? '';
}

function button(re: RegExp): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      re.test((b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? '')),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

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

function tapLetters(value: string): void {
  for (const ch of value) {
    const btn = document.querySelector<HTMLButtonElement>(`.letterpad-btn[aria-label="${ch}"]`);
    if (!btn) throw new Error(`Touche « ${ch} » introuvable sur le clavier`);
    fireEvent.click(btn);
  }
  fireEvent.click(document.querySelector<HTMLButtonElement>('.letterpad-btn-ok')!);
}

/** Profil dont la matière est déjà ouverte et le placement passé. */
function conjReadyProfile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.hasSeenConjIntro = true;
  p.hasDoneConjPlacement = true;
  p.lastSessionDate = null;
  p.lastMathSessionDate = null;
  p.lastConjSessionDate = null;
  // Deux faits introduits, tous deux en boîte 1 : `shouldIntroduceNew` refuse
  // alors d'ouvrir un fait neuf, et la séance se réduit à la révision due
  // + une révision bonus. Deux questions : de quoi jouer une séance entière
  // dans un test sans en faire un marathon.
  p.conjFacts = (p.conjFacts ?? []).map((f): ConjFact => {
    if (f.key === 'pres-g1-nous') {
      return { ...f, introduced: true, box: 1, lastSeen: '2026-01-01', nextDue: '2026-01-01' };
    }
    if (f.key === 'imp-il') {
      return { ...f, introduced: true, box: 1, lastSeen: '2026-01-01', nextDue: '2099-12-31' };
    }
    return f;
  });
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

    expect(migrated.conjFacts).toHaveLength(63);
    expect(migrated.conjFacts!.every((f) => f.box === 1 && !f.introduced)).toBe(true);
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

  it('un placement réussi ensemence les boîtes — l’image démarre déjà révélée', () => {
    const p = createNewProfile('Zoé');
    const before = p.conjFacts!.filter((f) => f.introduced).length;
    expect(before).toBe(0);

    // On rejoue le geste du placement sur la couche domaine (l'écran, lui, est
    // couvert ci-dessus) : réussir « vous parlerez » démontre la règle du futur.
    const seeded = { ...p, conjFacts: p.conjFacts!.map((f) => ({ ...f })) };
    seedConjFromPlacement(
      seeded.conjFacts,
      [{ key: 'fut-vous', correct: true, timeMs: 1000 }],
      TODAY,
    );
    expect(seeded.conjFacts.filter((f) => f.introduced).length).toBeGreaterThan(1);
  });
});

describe('Espace parent — section conjugaison miroir (spec §8, §11)', () => {
  function renderStats(p: UserProfile) {
    return render(
      <LangProvider>
        <ParentStats profile={p} />
      </LangProvider>,
    );
  }

  it('un onglet Conjugaison ouvre l’histogramme et la grille 8×8 de la matière', () => {
    const p = conjReadyProfile();
    renderStats(p);

    const tab = Array.from(document.querySelectorAll<HTMLButtonElement>('.progress-tab')).find(
      (b) => b.textContent === 'Conjugaison',
    );
    expect(tab).toBeDefined();
    fireEvent.click(tab!);

    expect(text()).toContain('Formes verbales maîtrisées');
    // Grille sans en-têtes : 64 cases, aucune gouttière de numéros de table.
    expect(document.querySelector('.progress-grid--plain')).not.toBeNull();
    expect(document.querySelectorAll('.progress-grid-cell')).toHaveLength(64);
    expect(document.querySelectorAll('.progress-grid-header')).toHaveLength(0);
    // Histogramme : les 63 faits sont répartis (61 non introduits + 2 en B1).
    const counts = Array.from(document.querySelectorAll('.parent-histogram-count')).map((n) =>
      Number(n.textContent),
    );
    expect(counts[0]).toBe(61);
    expect(counts[1]).toBe(2);
  });

  it('les faits difficiles de la matière rejoignent la liste, fenêtre glissante comprise', () => {
    const p = conjReadyProfile();
    p.sessionHistory = [
      {
        date: TODAY,
        questionsCount: 2,
        correctCount: 1,
        averageTimeMs: 3000,
        newFactsIntroduced: 0,
        factsPromoted: 0,
        questions: [
          {
            kind: 'conj',
            a: 0,
            b: 0,
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
    renderStats(p);

    expect(text()).toContain('Faits les plus difficiles');
    expect(text()).toContain('nous mangeons');
  });

  it('en anglais, la matière n’apparaît nulle part dans l’espace parent', () => {
    const p = conjReadyProfile();
    applyLang('en');
    renderStats(p);

    expect(text()).not.toMatch(/Conjugation|Verb forms mastered/);
    expect(document.querySelector('.progress-grid--plain')).toBeNull();
  });
});

describe('Séance de conjugaison : flamme partagée, matières indépendantes (spec §7.2)', () => {
  it('une séance de conjugaison entretient la série sans fermer la séance de maths', async () => {
    saveProfile(conjReadyProfile());

    renderApp();
    fireEvent.click(button(/Conjugaison/)!);
    await flush();

    // Deux questions : la révision due, puis une révision bonus.
    tapLetters(expectedOf('pres-g1-nous'));
    advance(2500);
    tapLetters(expectedOf('imp-il'));
    advance(2500);

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

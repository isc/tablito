import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ParentOverview from '../components/ParentOverview';
import ParentSubjectDetail from '../components/ParentSubjectDetail';
import { createInitialConjFacts } from '../lib/conjugationFacts';
import type { Subject } from '../lib/hardestFacts';
import { createNewProfile } from '../lib/storage';
import { requireButton, text } from './helpers/dom';
import { BADGE_IDS, type BoxLevel, type SessionQuestionLog, type SessionResult, type UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Accueil de l'espace parent et page Maths : trois niveaux de maths sans
// trois onglets. L'accueil résume le niveau en cours et coche les niveaux
// passés ; la page de la matière garde un sélecteur de niveau pour la maîtrise
// et la grille, ouvert sur le niveau en cours.
// ---------------------------------------------------------------------------

const mastered = { box: 5 as const, introduced: true, lastSeen: '2026-07-01', nextDue: '2099-12-31' };

// Niveau 3 débloqué : tables ET divisions en boîte 5, badges de déblocage
// posés explicitement (cf. remainderJourney).
function level3Profile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.facts = p.facts.map((f) => ({ ...f, ...mastered }));
  p.divisionFacts = p.divisionFacts!.map((f) => ({ ...f, ...mastered }));
  for (let n = 2; n <= 9; n++) {
    p.badges.push({ id: `${BADGE_IDS.TABLE_PREFIX}${n}`, earnedDate: '2026-06-01', icon: '' });
    p.badges.push({ id: `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`, earnedDate: '2026-07-01', icon: '' });
  }
  return p;
}

function pills(): string[] {
  return Array.from(document.querySelectorAll('.parent-level-pill')).map((el) =>
    `${el.classList.contains('is-done') ? '✓ ' : ''}${el.textContent}`.trim(),
  );
}

// Une réponse ratée : une multiplication par défaut (`a`, `b`), ou un fait de
// conjugaison (`kind: 'conj'`, `factKey`).
function miss(over: Partial<SessionQuestionLog>): SessionQuestionLog {
  return {
    kind: 'mult',
    correct: false,
    responseTimeMs: 4000,
    answeredWith: null,
    isBonusReview: false,
    inputMode: 'keypad',
    ...over,
  };
}

function renderOverview(p: UserProfile, onOpenSubject: (subject: Subject) => void = () => {}) {
  render(<ParentOverview profile={p} onOpenSubject={onOpenSubject} />);
}

afterEach(cleanup);

describe("accueil de l'espace parent", () => {
  it('résume la journée et les compteurs cumulés dans une seule carte', () => {
    const p = createNewProfile('Zoé');
    p.totalSessions = 42;
    p.longestStreak = 12;
    renderOverview(p);

    const kpis = Array.from(document.querySelectorAll('.parent-activity .parent-kpi')).map((el) => [
      el.querySelector('.parent-stat-label')?.textContent,
      el.querySelector('.parent-stat-value')?.textContent,
    ]);
    expect(kpis).toEqual([
      ['Séances', '42'],
      ['Série actuelle', '0'],
      ['Meilleure série', '12'],
    ]);
  });

  it('au niveau 1, la carte Maths montre les multiplications, sans pastille', () => {
    const p = createNewProfile('Zoé');
    const open = vi.fn();
    renderOverview(p, open);

    const card = document.querySelector<HTMLButtonElement>('.parent-subject-card--math')!;
    expect(card.querySelector('.parent-subject-sub')?.textContent).toBe('En cours : les multiplications');
    expect(card.querySelector('.parent-level-count')?.textContent).toBe(`0 / ${p.facts.length}`);
    expect(pills()).toEqual([]);
    // Conjugaison jamais ouverte : pas de carte.
    expect(document.querySelector('.parent-subject-card--conj')).toBeNull();

    fireEvent.click(card);
    expect(open).toHaveBeenCalledWith('math');
  });

  it('au niveau 3, coche les niveaux passés et détaille le niveau en cours', () => {
    const p = level3Profile();
    renderOverview(p);

    const card = document.querySelector('.parent-subject-card--math')!;
    expect(card.querySelector('.parent-subject-sub')?.textContent).toBe(
      'En cours : la division avec reste',
    );
    expect(pills()).toEqual(['✓ Multiplications', '✓ Divisions']);
    expect(card.querySelector('.parent-level-name')?.textContent).toBe('Divisions avec reste');
    expect(card.querySelector('.parent-level-count')?.textContent).toBe(
      `0 / ${p.remainderFacts!.length}`,
    );
  });

  it("décoche un niveau passé dès qu'un fait y retombe", () => {
    const p = level3Profile();
    p.facts = p.facts.map((f) => (f.a === 7 && f.b === 8 ? { ...f, box: 2 } : f));
    renderOverview(p);

    expect(pills()).toEqual([`Multiplications ${p.facts.length - 1}/${p.facts.length}`, '✓ Divisions']);
  });

  it('« À retravailler » croise les matières : les 3 faits les plus ratés', () => {
    const p = createNewProfile('Zoé');
    p.hasSeenConjIntro = true;
    // Seuls les faits déjà vus en séance peuvent figurer dans la liste.
    p.conjFacts = createInitialConjFacts().map((f) =>
      f.key === 'pres-g1-nous' ? { ...f, introduced: true } : f,
    );
    const boxOf: Record<string, BoxLevel> = { '7x8': 2, '6x7': 3, '4x9': 1 };
    p.facts = p.facts.map((f) => {
      const box = boxOf[`${f.a}x${f.b}`];
      return box ? { ...f, introduced: true, box } : f;
    });
    const base = { questionsCount: 10, correctCount: 5, averageTimeMs: 3000, newFactsIntroduced: 0, factsPromoted: 0 };
    p.sessionHistory = [
      {
        ...base,
        kind: 'mult',
        date: '2026-09-01',
        questions: [[7, 8], [7, 8], [7, 8], [6, 7], [4, 9]].map(([a, b]) => miss({ a, b })),
      },
      {
        ...base,
        kind: 'conj',
        date: '2026-09-01',
        questions: [1, 2].map(() => miss({ kind: 'conj', factKey: 'pres-g1-nous' })),
      },
    ];
    renderOverview(p);

    const names = Array.from(document.querySelectorAll('.parent-hard-fact-name')).map((el) => el.textContent);
    // Erreurs décroissantes, puis la boîte la plus basse : 4 × 9 (boîte 1)
    // passe devant 6 × 7 (boîte 3), qui ne tient plus dans les trois.
    expect(names).toEqual(['7 × 8 = 56', 'nous mangeons', '4 × 9 = 36']);
    // L'idée pour aider porte sur le premier : l'astuce que la séance enseigne.
    expect(document.querySelector('.parent-idea-body')?.textContent).toBe(
      'Rappelez-lui l’astuce vue dans Tablito\u00a0: «\u00a0× 7, c’est × 5 plus × 2.\u00a0» Par exemple\u00a0: 8 × 7 = 8 × 5 + 8 × 2 = 40 + 16 = 56.',
    );
  });
});

describe('point de la semaine', () => {
  // Cette semaine : du 14 au 20 septembre ; la semaine d'avant : du 7 au 13.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const session = (date: string, over: Partial<SessionResult> = {}): SessionResult => ({
    date,
    kind: 'mult',
    questionsCount: 10,
    correctCount: 8,
    averageTimeMs: 3000,
    newFactsIntroduced: 0,
    factsPromoted: 0,
    ...over,
  });

  const rows = () =>
    Array.from(document.querySelectorAll('.parent-week-row')).map((el) =>
      Array.from(el.querySelectorAll('.parent-week-main, .parent-week-sub')).map((part) => part.textContent),
    );

  it('dit la semaine en phrases, comparée à la semaine d’avant', () => {
    const p = createNewProfile('Zoé');
    p.startDate = '2026-06-01';
    p.sessionHistory = [
      session('2026-09-08', { correctCount: 7, averageTimeMs: 3100 }),
      session('2026-09-15', { correctCount: 9, averageTimeMs: 2600, factsPromoted: 5, newFactsIntroduced: 2 }),
      session('2026-09-18', { correctCount: 9, averageTimeMs: 2600, factsPromoted: 4 }),
    ];
    renderOverview(p);

    expect(rows()).toEqual([
      ['2 jours sur 7', '1 de plus que la semaine d’avant.'],
      ['90\u00a0% de bonnes réponses en maths', '20 points de mieux que la semaine d’avant.'],
      ['2,6\u00a0s par calcul', 'Plus rapide de 0,5\u00a0s que la semaine d’avant.'],
      ['9 faits ont gagné une boîte', 'Et 2 nouveaux ont été découverts.'],
    ]);
  });

  it('une semaine sans séance le dit, sans chiffres', () => {
    const p = createNewProfile('Zoé');
    p.sessionHistory = [session('2026-09-02')];
    renderOverview(p);
    expect(rows()).toEqual([['Aucune séance ces 7 derniers jours']]);
  });

  it("n'apparaît pas avant la première séance", () => {
    renderOverview(createNewProfile('Zoé'));
    expect(document.querySelector('.parent-week-rows')).toBeNull();
  });
});

describe('page Maths', () => {
  function segments(): string[] {
    return Array.from(document.querySelectorAll('.parent-segmented-option')).map((el) =>
      `${el.classList.contains('is-active') ? '● ' : ''}${el.textContent}`,
    );
  }

  it('au niveau 1, ni sélecteur de niveau ni mention des séances mixtes', () => {
    render(<ParentSubjectDetail profile={createNewProfile('Zoé')} subject="math" />);
    expect(document.querySelector('.parent-segmented')).toBeNull();
    expect(text()).toContain('Multiplications maîtrisées');
  });

  it('au niveau 3, ouvre le niveau en cours et bascule de niveau sans quitter la page', () => {
    const p = level3Profile();
    render(<ParentSubjectDetail profile={p} subject="math" />);

    expect(segments()).toEqual(['Multiplications', 'Divisions', '● Avec reste']);
    expect(document.querySelector('.parent-mastery-label')?.textContent).toBe(
      'Divisions avec reste maîtrisées',
    );
    expect(document.querySelector('.parent-mastery-number')?.textContent).toBe('0');

    fireEvent.click(requireButton(/^Multiplications$/));
    expect(segments()).toEqual(['● Multiplications', 'Divisions', 'Avec reste']);
    expect(document.querySelector('.parent-mastery-label')?.textContent).toBe(
      'Multiplications maîtrisées',
    );
    expect(document.querySelector('.parent-mastery-number')?.textContent).toBe(String(p.facts.length));
    expect(document.querySelector('.parent-mastery-total')?.textContent).toBe(`/ ${p.facts.length}`);
  });
});

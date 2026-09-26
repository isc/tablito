import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ParentOverview from '../components/ParentOverview';
import ParentSubjectDetail from '../components/ParentSubjectDetail';
import { createInitialConjFacts } from '../lib/conjugationFacts';
import { createNewProfile } from '../lib/storage';
import { requireButton, text } from './helpers/dom';
import { BADGE_IDS, type BoxLevel, type SessionQuestionLog, type UserProfile } from '../types';

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

function miss(a: number, b: number): SessionQuestionLog {
  return { kind: 'mult', a, b, correct: false, responseTimeMs: 4000, answeredWith: null, isBonusReview: false, inputMode: 'keypad' };
}

afterEach(cleanup);

describe("accueil de l'espace parent", () => {
  it('résume la journée et les compteurs cumulés dans une seule carte', () => {
    const p = createNewProfile('Zoé');
    p.totalSessions = 42;
    p.longestStreak = 12;
    render(<ParentOverview profile={p} onOpenSubject={() => {}} />);

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
    render(<ParentOverview profile={p} onOpenSubject={open} />);

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
    render(<ParentOverview profile={p} onOpenSubject={() => {}} />);

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
    render(<ParentOverview profile={p} onOpenSubject={() => {}} />);

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
      { ...base, kind: 'mult', date: '2026-09-01', questions: [miss(7, 8), miss(7, 8), miss(7, 8), miss(6, 7), miss(4, 9)] },
      {
        ...base,
        kind: 'conj',
        date: '2026-09-01',
        questions: [1, 2].map(() => ({
          kind: 'conj' as const,
          factKey: 'pres-g1-nous',
          correct: false,
          responseTimeMs: 4000,
          answeredWith: null,
          isBonusReview: false,
          inputMode: 'keypad' as const,
        })),
      },
    ];
    render(<ParentOverview profile={p} onOpenSubject={() => {}} />);

    const names = Array.from(document.querySelectorAll('.parent-hard-fact-name')).map((el) => el.textContent);
    // Erreurs décroissantes, puis la boîte la plus basse : 4 × 9 (boîte 1)
    // passe devant 6 × 7 (boîte 3), qui ne tient plus dans les trois.
    expect(names).toEqual(['7 × 8 = 56', 'nous mangeons', '4 × 9 = 36']);
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

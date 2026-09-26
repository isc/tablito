import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import ParentSubjectDetail from '../components/ParentSubjectDetail';
import { createNewProfile, importProfile } from '../lib/storage';
import { requireButton, text } from './helpers/dom';
import type { SessionResult, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Espace parent : les séances de maths et de conjugaison ne se mélangent pas.
//
// « Le temps de réponse moyen dans l'espace parent mélange les conjugaisons et
// les maths » (avis du 02/09/2026). Rappeler 7 × 8 et écrire « nous chantions »
// ne se mesurent pas au même mètre : sur une courbe commune, la moyenne du jour
// ne dit plus que la matière pratiquée ce jour-là. Chaque matière a donc sa
// page, qui ne lit que SES séances (évolution et historique).
// ---------------------------------------------------------------------------

function session(over: Partial<SessionResult>): SessionResult {
  return {
    date: '2026-09-01',
    questionsCount: 10,
    correctCount: 10,
    averageTimeMs: 2000,
    newFactsIntroduced: 0,
    factsPromoted: 0,
    ...over,
  };
}

// Conjugaison ouverte et un historique donné.
function profileWith(sessions: SessionResult[]): UserProfile {
  const profile = createNewProfile('Zoé');
  profile.hasSeenConjIntro = true;
  profile.sessionHistory = sessions;
  return profile;
}

// Les deux matières tombent le MÊME jour — c'est le cas réel : l'accueil
// propose les deux tuiles chaque jour.
function mixedProfile(): UserProfile {
  return profileWith([
    session({ date: '2026-08-31', kind: 'mult', averageTimeMs: 3000 }),
    session({ date: '2026-08-31', kind: 'conj', averageTimeMs: 12000 }),
    session({ date: '2026-09-01', kind: 'mult', averageTimeMs: 3000 }),
    session({ date: '2026-09-01', kind: 'conj', averageTimeMs: 12000 }),
  ]);
}

function sessionTimes(): string[] {
  return Array.from(document.querySelectorAll('.parent-session-time')).map(
    (el) => el.textContent ?? '',
  );
}

function caption(): string {
  return document.querySelector('.parent-evolution .parent-card-caption')?.textContent ?? '';
}

afterEach(cleanup);

describe('espace parent — séparation des matières', () => {
  it("n'affiche que les séances de maths sur la page Maths", () => {
    render(<ParentSubjectDetail profile={mixedProfile()} subject="math" />);
    expect(sessionTimes()).toEqual(['3,0 s', '3,0 s']);
  });

  it("n'affiche que les séances de conjugaison sur la page Conjugaison", () => {
    render(<ParentSubjectDetail profile={mixedProfile()} subject="conj" />);
    expect(sessionTimes()).toEqual(['12,0 s', '12,0 s']);
  });

  it("calcule la moyenne de l'évolution sur les seules séances de la matière", () => {
    render(<ParentSubjectDetail profile={mixedProfile()} subject="math" />);
    expect(caption()).toBe('2 dernières séances · moyenne 100 %');
    fireEvent.click(requireButton(/^Rapidité$/));
    // 3 s et non 7,5 s : les 12 s de la conjugaison n'y entrent pas.
    expect(caption()).toBe('2 dernières séances · moyenne 3,0 s');
  });

  it('classe les séances antérieures au champ `kind` au chargement du profil', () => {
    // Séances enregistrées avant qu'on consigne la matière : celle qui porte un
    // journal de conjugaison s'y retrouve, celle qui n'a rien reste en maths
    // (avant la conjugaison, toute séance en était).
    const stored = profileWith([
      session({
        date: '2026-08-31',
        averageTimeMs: 12000,
        questions: [
          {
            kind: 'conj',
            factKey: 'pres-g1-nous',
            correct: true,
            responseTimeMs: 12000,
            answeredWith: null,
            isBonusReview: false,
            inputMode: 'keypad',
          },
        ],
      }),
      session({ date: '2026-09-01', averageTimeMs: 3000 }),
    ]);
    const profile = importProfile(JSON.stringify(stored))!;

    render(<ParentSubjectDetail profile={profile} subject="math" />);
    expect(sessionTimes()).toEqual(['3,0 s']);
    cleanup();
    render(<ParentSubjectDetail profile={profile} subject="conj" />);
    expect(sessionTimes()).toEqual(['12,0 s']);
  });
});

describe('espace parent — historique replié', () => {
  it('montre les 5 dernières séances, la plus récente en tête, et le reste sur demande', () => {
    const days = ['01', '02', '03', '04', '05', '06', '07'];
    const profile = profileWith(
      days.map((d, i) => session({ date: `2026-09-${d}`, kind: 'mult', correctCount: i + 1 })),
    );
    render(<ParentSubjectDetail profile={profile} subject="math" />);

    const scores = () =>
      Array.from(document.querySelectorAll('.parent-session-score')).map((el) => el.textContent);
    expect(scores()).toEqual(['7/10', '6/10', '5/10', '4/10', '3/10']);

    fireEvent.click(requireButton(/^Tout afficher \(7\)$/));
    expect(scores()).toHaveLength(7);
    expect(text()).not.toContain('Tout afficher');
  });
});

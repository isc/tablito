import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import ParentStats from '../components/ParentStats';
import { createNewProfile, importProfile } from '../lib/storage';
import { requireButton } from './helpers/dom';
import type { SessionResult, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Espace parent : les séances de maths et de conjugaison ne se mélangent pas.
//
// « Le temps de réponse moyen dans l'espace parent mélange les conjugaisons et
// les maths » (avis du 02/09/2026). Rappeler 7 × 8 et écrire « nous chantions »
// ne se mesurent pas au même mètre : sur une courbe commune, la moyenne du jour
// ne dit plus que la matière pratiquée ce jour-là. L'onglet de matière pilote
// donc aussi l'évolution et l'historique.
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

// Conjugaison ouverte (sinon pas de sélecteur de matière) et un historique
// donné. Le `hasSeenConjIntro` est la précondition non évidente : sans lui le
// sélecteur disparaît au lieu d'échouer bruyamment.
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

afterEach(cleanup);

describe('espace parent — séparation des matières', () => {
  it("n'affiche que les séances de maths sous l'onglet multiplication", () => {
    render(<ParentStats profile={mixedProfile()} />);
    expect(sessionTimes()).toEqual(['3.0s', '3.0s']);
  });

  it("bascule sur les séances de conjugaison quand on ouvre l'onglet", () => {
    render(<ParentStats profile={mixedProfile()} />);
    fireEvent.click(requireButton(/^Conjugaison$/));
    expect(sessionTimes()).toEqual(['12.0s', '12.0s']);
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

    render(<ParentStats profile={profile} />);
    expect(sessionTimes()).toEqual(['3.0s']);
    fireEvent.click(requireButton(/^Conjugaison$/));
    expect(sessionTimes()).toEqual(['12.0s']);
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ACTIVITY_WINDOW_DAYS, buildActivityDays } from '../lib/activity';
import { createNewProfile } from '../lib/storage';
import type { FactKind, SessionResult, UserProfile } from '../types';

// Même fabrique que parentSubjectSplit.test.tsx : on part d'un profil réel
// (createNewProfile) plutôt que d'un littéral, qui se périmerait au prochain
// champ obligatoire de UserProfile.
function makeProfile(
  sessions: Array<[string, FactKind]>,
  extra: Partial<UserProfile> = {},
): UserProfile {
  const profile = createNewProfile('Zoé');
  profile.sessionHistory = sessions.map(
    ([date, kind]): SessionResult => ({
      date,
      kind,
      questionsCount: 10,
      correctCount: 8,
      averageTimeMs: 3000,
      newFactsIntroduced: 0,
      factsPromoted: 0,
    }),
  );
  profile.totalSessions = sessions.length;
  profile.lastSessionDate = sessions.length ? sessions[sessions.length - 1][0] : null;
  return { ...profile, ...extra };
}

const TODAY = '2026-09-07';

function dayOf(days: ReturnType<typeof buildActivityDays>, date: string) {
  const found = days.find((d) => d.date === date);
  if (!found) throw new Error(`${date} absent de la fenêtre`);
  return found;
}

describe('buildActivityDays', () => {
  it('rend la fenêtre en ordre chronologique, aujourd’hui en dernier', () => {
    const days = buildActivityDays(makeProfile([]), TODAY);
    expect(days).toHaveLength(ACTIVITY_WINDOW_DAYS);
    expect(days[0].date).toBe('2026-08-25');
    expect(days[days.length - 1].date).toBe(TODAY);
  });

  it('sépare les matières sur un même jour', () => {
    const days = buildActivityDays(
      makeProfile([
        ['2026-09-06', 'mult'],
        ['2026-09-06', 'conj'],
        [TODAY, 'mult'],
      ]),
      TODAY,
    );
    expect(dayOf(days, '2026-09-06')).toMatchObject({ math: true, conj: true });
    expect(dayOf(days, TODAY)).toMatchObject({ math: true, conj: false });
  });

  it('range division et reste avec les maths', () => {
    const days = buildActivityDays(
      makeProfile([
        ['2026-09-05', 'div'],
        ['2026-09-06', 'rem'],
      ]),
      TODAY,
    );
    expect(dayOf(days, '2026-09-05').math).toBe(true);
    expect(dayOf(days, '2026-09-06').math).toBe(true);
  });

  it('neutralise la conjugaison avant sa première séance, pas après', () => {
    const days = buildActivityDays(
      makeProfile([
        ['2026-08-30', 'mult'],
        ['2026-09-02', 'conj'],
        ['2026-09-05', 'mult'],
      ]),
      TODAY,
    );
    // Avant l'ouverture : ni fait ni manqué — la matière n'existait pas.
    expect(dayOf(days, '2026-08-30').conj).toBeNull();
    expect(dayOf(days, '2026-09-02').conj).toBe(true);
    // Après l'ouverture, un jour sans conjugaison est un vrai jour sans.
    expect(dayOf(days, '2026-09-05').conj).toBe(false);
  });

  it('ne neutralise que le passé quand la conjugaison n’a jamais eu de séance', () => {
    const days = buildActivityDays(makeProfile([['2026-09-05', 'mult']]), TODAY);
    expect(dayOf(days, '2026-09-05').conj).toBeNull();
    expect(dayOf(days, TODAY).conj).toBe(false);
  });

  it('garde la conjugaison ouverte quand ses séances sont sorties de l’historique', () => {
    // L'historique est plafonné à 50 séances : un enfant qui a lâché la
    // conjugaison n'en a plus une seule, mais `lastConjSessionDate` la date.
    const days = buildActivityDays(
      makeProfile([['2026-09-05', 'mult']], { lastConjSessionDate: '2026-07-01' }),
      TODAY,
    );
    expect(dayOf(days, '2026-09-05').conj).toBe(false);
    expect(dayOf(days, TODAY).conj).toBe(false);
  });

  it('traite une séance sans `kind` comme des maths (profils antérieurs)', () => {
    const profile = makeProfile([['2026-09-05', 'mult']]);
    delete profile.sessionHistory[0].kind;
    expect(dayOf(buildActivityDays(profile, TODAY), '2026-09-05').math).toBe(true);
  });
});

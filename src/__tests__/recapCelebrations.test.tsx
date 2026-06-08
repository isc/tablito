// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import RecapScreen from '../screens/RecapScreen';
import { BADGE_IDS } from '../types';
import type { Badge, SessionResult } from '../types';

afterEach(cleanup);

const result: SessionResult = {
  date: '2026-06-05',
  questionsCount: 12,
  correctCount: 12,
  averageTimeMs: 2000,
  newFactsIntroduced: 0,
  factsPromoted: 2,
};

const baseProps = {
  name: 'Zoé',
  result,
  newBadges: [] as Badge[],
  newlyCompletedTables: [] as number[],
  divisionJustUnlocked: false,
  currentStreak: 3,
  freezeJustUsed: false,
  freezeJustEarned: false,
  knownFactsCount: 10,
  totalFacts: 64,
  onFinish: () => {},
  onShowProgress: () => {},
};

const badge = (id: string): Badge => ({ id, name: id, description: '', earnedDate: '2026-06-05', icon: '🎓' });

describe('RecapScreen — célébration de complétion de table', () => {
  it('mode div : « divisions par N »', () => {
    const { getByText, queryByText } = render(
      <RecapScreen {...baseProps} mode="div" newlyCompletedTables={[7]} />,
    );
    expect(getByText(/Tu as maîtrisé les divisions par 7/)).toBeTruthy();
    expect(queryByText(/la table de 7/)).toBeNull();
  });

  it('mode mult : « table de N » (parité préservée)', () => {
    const { getByText, queryByText } = render(
      <RecapScreen {...baseProps} mode="mult" newlyCompletedTables={[7]} />,
    );
    expect(getByText(/Tu as maîtrisé la table de 7/)).toBeTruthy();
    expect(queryByText(/divisions par 7/)).toBeNull();
  });
});

describe('RecapScreen — image division entièrement révélée', () => {
  it('mode div + badge Maître de la division : carte de félicitation', () => {
    const { getByText } = render(
      <RecapScreen {...baseProps} mode="div" newBadges={[badge(BADGE_IDS.DIV_GENIE)]} />,
    );
    expect(getByText(/Tu maîtrises toutes les divisions/)).toBeTruthy();
  });

  it('mode mult : la carte image-division ne s\'affiche pas', () => {
    const { queryByText } = render(
      <RecapScreen {...baseProps} mode="mult" divisionJustUnlocked />,
    );
    expect(queryByText(/Tu maîtrises toutes les divisions/)).toBeNull();
  });
});

describe('RecapScreen — déblocage du niveau 2', () => {
  it('mode mult + divisionJustUnlocked : carte « Tu débloques les divisions »', () => {
    const { queryByText } = render(
      <RecapScreen {...baseProps} mode="mult" divisionJustUnlocked />,
    );
    expect(queryByText(/Tu débloques les divisions/)).toBeTruthy();
  });

  it('le badge Génie seul ne déclenche PAS la carte de déblocage (découplé)', () => {
    const { queryByText } = render(
      <RecapScreen {...baseProps} mode="mult" newBadges={[badge(BADGE_IDS.GENIE_MATHS)]} />,
    );
    expect(queryByText(/Tu débloques les divisions/)).toBeNull();
  });
});

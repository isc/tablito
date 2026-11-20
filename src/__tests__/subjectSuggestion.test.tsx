import { cleanup, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNewProfile } from '../lib/storage';
import { suggestSubject } from '../lib/subjectSuggestion';
import HomeScreen from '../screens/HomeScreen';
import type { Subject } from '../lib/hardestFacts';
import type { UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Suggestion de matière sur l'accueil (specs §15.1). Avis parent du
// 20/11/2026 : l'enfant faisait les maths, première tuile, et laissait la
// conjugaison de côté (2 jours sur 13).
// ---------------------------------------------------------------------------

const TODAY = '2026-11-21';

/** Les trois tuiles de l'accueil en français ; `available` = séance du jour à faire. */
function offered(available: Subject[], shown: Subject[] = ['math', 'conj', 'irr']) {
  return shown.map((subject) => ({ subject, available: available.includes(subject) }));
}

function profileWith(dates: Partial<Pick<UserProfile, 'lastMathSessionDate' | 'lastConjSessionDate' | 'lastIrrSessionDate'>>): UserProfile {
  return { ...createNewProfile('Zoé'), ...dates };
}

describe('suggestSubject', () => {
  it('met en avant la matière délaissée depuis le plus longtemps', () => {
    const profile = profileWith({ lastMathSessionDate: '2026-11-20', lastConjSessionDate: '2026-11-16' });
    expect(suggestSubject(profile, offered(['math', 'conj', 'irr']), TODAY)).toEqual({ subject: 'conj', days: 5 });
  });

  it('la suggère encore une fois les autres matières faites aujourd’hui', () => {
    const profile = profileWith({ lastMathSessionDate: TODAY, lastConjSessionDate: '2026-11-18' });
    expect(suggestSubject(profile, offered(['conj', 'irr']), TODAY)).toEqual({ subject: 'conj', days: 3 });
  });

  it('ne suggère rien pour une matière faite hier', () => {
    const profile = profileWith({ lastMathSessionDate: TODAY, lastConjSessionDate: '2026-11-20' });
    expect(suggestSubject(profile, offered(['conj', 'irr']), TODAY)).toBeNull();
  });

  it('ne suggère rien à égalité : l’enfant alterne déjà', () => {
    const profile = profileWith({ lastMathSessionDate: '2026-11-16', lastConjSessionDate: '2026-11-16' });
    expect(suggestSubject(profile, offered(['math', 'conj', 'irr']), TODAY)).toBeNull();
  });

  it('ne suggère jamais une matière jamais commencée', () => {
    const profile = profileWith({ lastMathSessionDate: '2026-11-10', lastConjSessionDate: '2026-11-16' });
    expect(suggestSubject(profile, offered(['math', 'conj', 'irr']), TODAY)).toEqual({ subject: 'math', days: 11 });
  });

  it('ne suggère rien quand une seule matière a été commencée', () => {
    const profile = profileWith({ lastMathSessionDate: '2026-11-10' });
    expect(suggestSubject(profile, offered(['math', 'conj', 'irr']), TODAY)).toBeNull();
  });

  it('ne compte que les matières proposées (interface en anglais : maths seules)', () => {
    const profile = profileWith({ lastMathSessionDate: '2026-11-10', lastConjSessionDate: '2026-11-16' });
    expect(suggestSubject(profile, offered(['math'], ['math']), TODAY)).toBeNull();
  });

  it('ignore une matière dont la séance du jour n’est pas jouable', () => {
    const profile = profileWith({
      lastMathSessionDate: '2026-11-19',
      lastConjSessionDate: '2026-11-10',
      lastIrrSessionDate: '2026-11-15',
    });
    expect(suggestSubject(profile, offered(['math', 'irr']), TODAY)).toEqual({ subject: 'irr', days: 6 });
  });
});

describe('accueil : bulle et tuile suggérée', () => {
  const noop = () => {};

  function renderHome(profile: UserProfile) {
    render(
      <HomeScreen
        profile={profile}
        hasSessionAvailable
        hasNewRule={false}
        divisionUnlocked={false}
        conjAvailable
        hasConjSessionAvailable
        conjVisible
        onStartConj={noop}
        onStart={noop}
        onShowProgress={noop}
        onShowBadges={noop}
        onShowRules={noop}
        onShowParent={noop}
      />,
    );
  }

  const suggested = () =>
    Array.from(document.querySelectorAll('.home-subject-btn.is-suggested'), (b) => b.getAttribute('aria-label'));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T09:00:00'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('invite à la matière délaissée et souligne sa tuile, sans toucher aux autres', () => {
    renderHome(profileWith({ lastMathSessionDate: '2026-11-20', lastConjSessionDate: '2026-11-16' }));
    expect(document.querySelector('.home-suggest')?.textContent).toBe(
      'Et si on faisait un peu de conjugaison\u00a0? Ça fait 5\u00a0jours\u00a0!',
    );
    expect(suggested()).toEqual(['Conjugaison — commencer la séance du jour']);
    expect(document.querySelectorAll('.home-subject-btn:not(:disabled)')).toHaveLength(2);
  });

  it('se tait quand l’enfant alterne', () => {
    renderHome(profileWith({ lastMathSessionDate: '2026-11-20', lastConjSessionDate: '2026-11-20' }));
    expect(document.querySelector('.home-suggest')).toBeNull();
    expect(suggested()).toEqual([]);
  });
});

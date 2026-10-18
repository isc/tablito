import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import BadgesScreen from '../screens/BadgesScreen';
import { LangProvider } from '../i18n/LangProvider';
import { applyLang } from '../i18n/lang';
import { createNewProfile } from '../lib/storage';
import { findButton as button } from './helpers/dom';
import { unlockDivision } from './helpers/divisionProfiles';
import type { UserProfile } from '../types';

// Écran « Mes badges » : les badges rangés par section, et un onglet par
// matière dès qu'une seconde matière est visible (specs §4.2). Les matières
// visibles dépendent de la langue et de ce que l'enfant a ouvert.

function renderBadges(profile: UserProfile) {
  return render(
    <LangProvider>
      <BadgesScreen profile={profile} onBack={() => {}} />
    </LangProvider>,
  );
}

const titles = () => [...document.querySelectorAll('.badges-section > h2')].map((h) => h.textContent);
const tabs = () => [...document.querySelectorAll('.parent-segmented-option')].map((b) => b.textContent);
const badgeNames = () => [...document.querySelectorAll('.badge-name')].map((n) => n.textContent);

/** Profil qui a ouvert la conjugaison et les verbes anglais. */
function allSubjectsProfile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.hasSeenConjIntro = true;
  p.hasSeenIrrIntro = true;
  return p;
}

beforeEach(() => applyLang('fr'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  applyLang('fr');
});

describe('Écran « Mes badges »', () => {
  it('maths seules : des sections, pas d’onglets', () => {
    renderBadges(createNewProfile('Zoé'));
    expect(tabs()).toEqual([]);
    expect(titles()).toEqual(['Général', 'Multiplications']);
    expect(badgeNames()).toContain('Régularité');
    expect(badgeNames()).toContain('Table de 7');
  });

  it('un onglet par matière ouverte, les badges généraux hors onglets', () => {
    renderBadges(allSubjectsProfile());
    expect(tabs()).toEqual(['Maths', 'Conjugaison', 'Verbes anglais']);
    expect(badgeNames()).toContain('Table de 7');

    fireEvent.click(button(/^Conjugaison$/)!);
    expect(titles()).toEqual(['Général']);
    expect(badgeNames()).toContain('Régularité');
    expect(badgeNames()).not.toContain('Table de 7');
    expect(badgeNames().some((n) => /présent/i.test(n ?? ''))).toBe(true);
  });

  it('en anglais, ni conjugaison ni verbes anglais : pas d’onglets', () => {
    applyLang('en');
    renderBadges(allSubjectsProfile());
    expect(tabs()).toEqual([]);
    expect(titles()).toEqual(['General', 'Multiplications']);
  });

  it('les sections division n’apparaissent qu’une fois le niveau débloqué', () => {
    const p = createNewProfile('Zoé');
    unlockDivision(p);
    renderBadges(createNewProfile('Zoé'));
    expect(titles()).not.toContain('Divisions');
    cleanup();
    renderBadges(p);
    expect(titles()).toEqual(['Général', 'Multiplications', 'Divisions']);
  });
});

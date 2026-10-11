import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ParentSubjectDetail from '../components/ParentSubjectDetail';
import { createNewProfile } from '../lib/storage';
import { createInitialIrrFacts } from '../lib/irregularVerbs';
import type { UserProfile } from '../types';

// « Vus en classe » dans l'espace parent (specs §16.3) : le parent coche les
// verbes de la classe, dans l'ordre, et voit les prochains verbes annoncés.

afterEach(cleanup);

function irrProfile(irrClassVerbs?: string[]): UserProfile {
  const p = createNewProfile('Zoé');
  p.irrFacts = createInitialIrrFacts();
  if (irrClassVerbs) p.irrClassVerbs = irrClassVerbs;
  return p;
}

/** Rend la page et applique chaque mise à jour au profil, comme App. */
function renderEditable(initial: UserProfile) {
  let profile = initial;
  const onUpdateProfile = vi.fn((update: (p: UserProfile) => UserProfile) => {
    profile = update(profile);
    view.rerender(<ParentSubjectDetail profile={profile} subject="irr" onUpdateProfile={onUpdateProfile} />);
  });
  const view = render(<ParentSubjectDetail profile={profile} subject="irr" onUpdateProfile={onUpdateProfile} />);
  return { current: () => profile };
}

const card = () => within(document.querySelector<HTMLElement>('.irr-class-verbs')!);
const verb = (key: string) => card().getByRole('button', { name: new RegExp(`^\\d*${key}$`) });

describe('Vus en classe', () => {
  it('coche dans l’ordre, numérote, et annonce les prochains verbes', () => {
    const state = renderEditable(irrProfile());
    expect(screen.getByText(/Prochains verbes/).textContent).toContain('be, have, do, go');
    for (const key of ['be', 'begin', 'choose', 'break']) fireEvent.click(verb(key));
    expect(state.current().irrClassVerbs).toEqual(['be', 'begin', 'choose', 'break']);
    expect(verb('choose').getAttribute('aria-pressed')).toBe('true');
    expect(verb('choose').textContent).toBe('3choose');
    expect(screen.getByText(/Prochains verbes/).textContent).toContain('be, begin, choose, break');
  });

  it('décoche un verbe, ou toute la liste', () => {
    const state = renderEditable(irrProfile(['be', 'begin', 'choose']));
    fireEvent.click(verb('begin'));
    expect(state.current().irrClassVerbs).toEqual(['be', 'choose']);
    fireEvent.click(screen.getByRole('button', { name: 'Tout décocher' }));
    expect(state.current().irrClassVerbs).toEqual([]);
  });

  it('en lecture seule sans réglage possible (enfant suivi, autre profil)', () => {
    render(<ParentSubjectDetail profile={irrProfile(['begin'])} subject="irr" />);
    expect(card().queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText(/Se règle depuis l'appareil/)).toBeTruthy();
    expect(screen.getByText(/Prochains verbes/).textContent).toContain('begin, be');
  });
});

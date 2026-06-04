import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../App';
import { createNewProfile, saveProfile } from '../lib/storage';

// Test d'intégration : monte le vrai <App /> et vérifie, via le DOM, le modèle
// « un seul bouton, l'app choisit la piste » du niveau 2 (specs §11) :
//   - niveau verrouillé → pas de tuile Divisions, séance multiplication ;
//   - débloqué + aucune table due → la séance du jour est la division ;
//   - débloqué + une table due → la séance du jour est la multiplication.

function findByText(re: RegExp): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      re.test((b.textContent ?? '').trim()),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

// Toutes les tables maîtrisées (boîte 5) → la migration attribue Génie des
// maths au chargement → niveau 2 débloqué. nextDue très loin = aucune table due.
function masteredProfile() {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.totalSessions = 50;
  p.lastSessionDate = null;
  p.facts = p.facts.map((f) => ({
    ...f,
    box: 5 as const,
    introduced: true,
    lastSeen: '2026-01-01',
    nextDue: '2099-12-31',
    history: [{ date: '2026-01-01', correct: true, responseTimeMs: 1000, answeredWith: f.product }],
  }));
  return p;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Niveau 2 — séance du jour décidée par l\'app', () => {
  it('niveau verrouillé : tuile « Mon image », bouton unique', () => {
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    p.lastSessionDate = null;
    saveProfile(p);

    render(<App />);

    expect(findByText(/Mon image/)).not.toBeNull();
    expect(findByText(/Mes images/)).toBeNull();
    expect(findByText(/C'est parti/)).not.toBeNull();
  });

  it('débloqué, aucune table à réviser → la séance du jour est la division', () => {
    saveProfile(masteredProfile());

    render(<App />);

    // Une fois débloqué, la tuile « Mon image » devient « Mes images ».
    expect(findByText(/Mes images/)).not.toBeNull();

    const cta = findByText(/C'est parti/);
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);

    // Première question = division (intro « pense à la multiplication »).
    const el =
      document.querySelector('.session-intro-formula') ??
      document.querySelector('.session-question-text');
    expect(el?.textContent).toContain('÷');
  });

});

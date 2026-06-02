import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../App';
import { createNewProfile, saveProfile } from '../lib/storage';

// Test d'intégration : monte le vrai <App /> et vérifie le gating du niveau 2
// (division) + l'entrée en séance, uniquement via le DOM.

function findButton(re: RegExp): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      re.test((b.textContent ?? '').trim()),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Niveau 2 — flux division (UI)', () => {
  it('ne montre pas l\'accès division tant que le niveau n\'est pas débloqué', () => {
    // Profil par défaut (tables non maîtrisées) → pas de badge Génie des maths.
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    p.lastSessionDate = null;
    saveProfile(p);

    render(<App />);

    expect(findButton(/Les divisions/)).toBeNull();
  });

  it('débloque la division quand tout est maîtrisé et entre en séance', () => {
    // Toutes les multiplications en boîte 5 → la migration attribue le badge
    // Génie des maths au chargement → niveau 2 débloqué.
    const p = createNewProfile('Zoé');
    p.hasSeenRulesIntro = true;
    p.lastSessionDate = null;
    p.totalSessions = 50;
    p.facts = p.facts.map((f) => ({ ...f, box: 5, introduced: true }));
    saveProfile(p);

    render(<App />);

    const cta = findButton(/Les divisions/);
    expect(cta).not.toBeNull();

    fireEvent.click(cta!);

    // Première question de division = introduction : formule avec l'opérateur ÷.
    const formula = document.querySelector('.session-intro-formula');
    expect(formula).not.toBeNull();
    expect(formula?.textContent).toContain('÷');
  });
});

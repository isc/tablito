import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../App';
// Précharge le chunk lazy de l'écran progression pour qu'il se résolve dans le test.
import '../screens/ProgressScreen';
import { createNewProfile, saveProfile } from '../lib/storage';
import { BADGE_IDS } from '../types';

// Test d'intégration du niveau 3 (specs §12) : monte le vrai <App /> et
// vérifie, via le DOM, que la séance du jour bascule sur la division avec
// reste une fois les 8 badges « Divisions par N » acquis, et que la saisie
// se fait en deux temps (quotient puis reste).

function findByText(re: RegExp): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      re.test((b.textContent ?? '').trim()),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

function tapDigit(d: number): void {
  const btn = Array.from(document.querySelectorAll('.numpad-btn')).find(
    (b) => b.getAttribute('aria-label') === String(d),
  ) as HTMLButtonElement;
  fireEvent.click(btn);
}

function tapOk(): void {
  fireEvent.click(document.querySelector('.numpad-btn-ok') as HTMLButtonElement);
}

// Profil niveau 3 : tables ET divisions en boîte 5 (rien de dû), badges de
// déblocage posés explicitement (la migration n'attribue qu'une passe).
function level3Profile() {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.totalSessions = 120;
  p.lastSessionDate = null;
  const mastered = { box: 5 as const, introduced: true, lastSeen: '2026-07-01', nextDue: '2099-12-31' };
  p.facts = p.facts.map((f) => ({ ...f, ...mastered }));
  p.divisionFacts = p.divisionFacts!.map((f) => ({ ...f, ...mastered }));
  for (let n = 2; n <= 9; n++) {
    p.badges.push({ id: `${BADGE_IDS.TABLE_PREFIX}${n}`, earnedDate: '2026-06-01', icon: '' });
    p.badges.push({ id: `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`, earnedDate: '2026-07-01', icon: '' });
  }
  return p;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Niveau 3 — séance du jour et saisie en deux temps', () => {
  it('débloqué : la 1ʳᵉ question est une intro « cherche le multiple juste en dessous »', () => {
    saveProfile(level3Profile());
    render(<App />);

    fireEvent.click(findByText(/C'est parti/)!);

    // Intro de zone : formule « 5 ÷ 2 » + astuce d'encadrement.
    expect(document.querySelector('.session-intro-formula')?.textContent).toContain('÷');
    expect(document.body.textContent).toContain('multiple juste en dessous');
  });

  it('saisie en deux temps : quotient puis reste, feedback correct', async () => {
    saveProfile(level3Profile());
    render(<App />);
    fireEvent.click(findByText(/C'est parti/)!);

    // Passe l'intro → la question s'affiche. Première zone introduite : (2,2)
    // (doubles d'abord), reste canonique 1 → « 5 ÷ 2 », quotient 2, reste 1.
    fireEvent.click(findByText(/J'ai compris/)!);
    expect(document.querySelector('.session-question-text')?.textContent).toContain('5');
    expect(document.body.textContent).toContain('Combien de fois');

    // Étape 1 : quotient.
    tapDigit(2);
    tapOk();
    await waitFor(() => {
      expect(document.body.textContent).toContain('Il reste combien');
    });

    // Étape 2 : reste → feedback positif.
    tapDigit(1);
    tapOk();
    await waitFor(() => {
      expect(document.querySelector('.feedback-overlay.correct')).not.toBeNull();
    });
  });

  it('quotient faux : la question se termine tout de suite (feedback erreur ciblé)', async () => {
    saveProfile(level3Profile());
    render(<App />);
    fireEvent.click(findByText(/C'est parti/)!);
    fireEvent.click(findByText(/J'ai compris/)!);

    tapDigit(9); // 5 ÷ 2 → quotient attendu 2
    tapOk();
    await waitFor(() => {
      expect(document.querySelector('.feedback-overlay.incorrect')).not.toBeNull();
    });
    // L'égalité euclidienne de la zone est affichée (2 × 2 + 1).
    expect(document.body.textContent).toContain('reste');
  });

  it('« Mes images » propose l\'onglet « Avec reste », ouvert par défaut', async () => {
    saveProfile(level3Profile());
    render(<App />);

    fireEvent.click(findByText(/Mes images/)!);

    await waitFor(() => {
      const activeTab = document.querySelector('.progress-tab.active');
      expect(activeTab?.textContent).toContain('Avec reste');
    });
  });
});

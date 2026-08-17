import { act, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';

// Gestes DOM partagés par les tests d'écran de la matière conjugaison (et
// utilisables ailleurs) : taper sur le mini-clavier, avancer les timers,
// retrouver un bouton. Sous `helpers/` et sans suffixe `.test`, donc jamais
// collecté par vitest — même convention que `helpers/watchServer.ts`.

/** Tout le texte rendu, pour les assertions « l'écran dit … ». */
export function text(): string {
  return document.body.textContent ?? '';
}

/** Avance les timers factices dans un `act` (re-rendus compris). */
export function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Bouton dont le libellé accessible OU le texte visible matche. Les deux sont
 * regardés : les tuiles de l'accueil portent leur intitulé en `aria-label`,
 * les boutons de séance en texte.
 */
export function findButton(re: RegExp): HTMLButtonElement | null {
  const found = Array.from(document.querySelectorAll('button')).find((b) =>
    re.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`.trim()),
  );
  return (found as HTMLButtonElement | undefined) ?? null;
}

/** Variante qui échoue en nommant le bouton cherché, pour les clics. */
export function requireButton(re: RegExp): HTMLButtonElement {
  const btn = findButton(re);
  if (!btn) throw new Error(`Bouton ${re} introuvable`);
  return btn;
}

/** Tape des lettres sur le mini-clavier, SANS valider. */
export function typeLetters(letters: string): void {
  for (const ch of letters) {
    const btn = document.querySelector<HTMLButtonElement>(`.letterpad-btn[aria-label="${ch}"]`);
    if (!btn) throw new Error(`Touche « ${ch} » introuvable sur le clavier`);
    fireEvent.click(btn);
  }
}

/** Appuie sur « Valider » — la soumission du clavier est toujours explicite. */
export function tapValidate(): void {
  fireEvent.click(document.querySelector<HTMLButtonElement>('.letterpad-btn-ok')!);
}

/** Le geste complet d'une réponse : taper, puis valider. */
export function tapLetters(letters: string): void {
  typeLetters(letters);
  tapValidate();
}

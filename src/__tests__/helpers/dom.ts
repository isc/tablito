import { act, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';

// Gestes DOM partagés par les tests d'écran : taper sur les claviers, avancer
// les timers, laisser se régler les promesses, retrouver un bouton, ouvrir
// l'espace parent. Sous `helpers/` et sans suffixe `.test`, donc jamais
// collecté par vitest — même convention que `helpers/watchServer.ts`.

/**
 * Laisse se régler les promesses en attente (chunk lazy compris), dans un
 * `act`. Microtâches seulement : sûr sous timers factices.
 */
export async function flushMicrotasks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * Laisse passer des macrotâches : lecture de fichier, chiffrement et fetch ne
 * se règlent pas en une microtâche. Timers réels seulement.
 */
export async function flushMacrotasks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * De l'accueil de l'enfant à l'espace parent : son bouton, la multiplication
 * aléatoire du portail, puis le chunk lazy (à préchauffer par un import du
 * module dans le test).
 */
export async function openParentDashboard(): Promise<void> {
  fireEvent.click(document.querySelector<HTMLButtonElement>('.home-parent-btn')!);
  const operands = Array.from(document.querySelectorAll('.parent-gate-question span'))
    .map((s) => parseInt(s.textContent ?? '', 10))
    .filter((n) => Number.isFinite(n));
  if (operands.length < 2) throw new Error('Portail parent non affiché');
  const input = document.querySelector<HTMLInputElement>('.parent-gate-input')!;
  fireEvent.change(input, { target: { value: String(operands[0] * operands[1]) } });
  fireEvent.click(requireButton(/^Valider$/));
  await flushMicrotasks();
}

/** Titre de la page de réglage de l'espace parent affichée, s'il y en a une. */
export function settingsPageTitle(): string | null | undefined {
  return document.querySelector('.parent-dashboard--settings .parent-title')?.textContent;
}

/** Nombre affiché sous « Séances » dans la carte du jour de l'espace parent. */
export function sessionsShown(): string {
  const kpi = Array.from(document.querySelectorAll('.parent-kpi')).find(
    (el) => el.querySelector('.parent-stat-label')?.textContent === 'Séances',
  );
  return kpi?.querySelector('.parent-stat-value')?.textContent ?? '';
}

/** Les pastilles du sélecteur d'enfant de l'espace parent, dans l'ordre. */
export function childChips(): Array<{ name: string; remote: boolean; active: boolean }> {
  return Array.from(document.querySelectorAll('.parent-child')).map((el) => ({
    name: el.querySelector('.parent-child-name')?.textContent ?? '',
    remote: el.querySelector('.parent-child-remote') !== null,
    active: el.getAttribute('aria-pressed') === 'true',
  }));
}

/** La pastille d'un enfant, par son prénom. */
export function childChip(name: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('.parent-child')).find(
    (el) => el.querySelector('.parent-child-name')?.textContent === name,
  );
  if (!found) throw new Error(`Pas de pastille pour ${name}`);
  return found;
}

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

/** Tape un nombre sur le pavé numérique ; « OK » n'est nécessaire qu'à un chiffre. */
export function typeAnswer(value: number): void {
  const digits = value.toString();
  for (const d of digits) {
    const btn = document.querySelector<HTMLButtonElement>(`.numpad-btn[aria-label="${d}"]`);
    if (!btn) throw new Error(`NumPad ${d} introuvable`);
    fireEvent.click(btn);
  }
  if (digits.length === 1) fireEvent.click(document.querySelector<HTMLButtonElement>('.numpad-btn-ok')!);
}

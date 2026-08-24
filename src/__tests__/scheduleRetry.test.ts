// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { scheduleRetry, MAX_SESSION_QUESTIONS } from '../lib/utils';

// Régression du 23/08/2026 (avis parent) : « ma séance de conjugaison était
// mal organisée, j'ai eu plusieurs fois les mêmes questions ». Deux re-poses
// déclenchées coup sur coup — les deux intros du jour — se replaçaient au MÊME
// écart et revenaient collées l'une à l'autre. Le contrat complet est décrit
// sur `scheduleRetry`.

interface Q {
  id: string;
  isIntroduction: boolean;
  isRetry: boolean;
}

const q = (id: string): Q => ({ id, isIntroduction: false, isRetry: false });

const ids = (queue: Q[]) => queue.map((item) => item.id).join(' ');

describe('scheduleRetry', () => {
  it('ne colle pas deux reprises l’une à l’autre (A B A B)', () => {
    const queue = [q('A'), q('B'), q('c'), q('d'), q('e'), q('f')];

    // A re-posée depuis l'index 0, puis B depuis l'index 1 — l'ordre réel des
    // deux intros d'une séance de conjugaison.
    const afterA = scheduleRetry(queue, 0, queue[0], [2, 3]);
    const afterB = scheduleRetry(afterA, 1, afterA[1], [2, 3]);

    expect(ids(afterA)).toBe('A B A c d e f');
    expect(ids(afterB)).toBe('A B A c B d e f');
  });

  it('retombe sur le premier écart quand aucun créneau ne convient', () => {
    // Fenêtre saturée : les deux créneaux touchent une reprise déjà placée.
    // Best-effort, comme `interleaveGreedy` — on pose, on ne s'étire pas.
    const queue = [q('A'), q('b'), { ...q('r'), isRetry: true }, q('c')];

    expect(ids(scheduleRetry(queue, 0, queue[0], [2, 3]))).toBe('A b A r c');
  });

  it('n’écarte que les reprises, pas les questions ordinaires', () => {
    const queue = [q('A'), q('b'), q('c'), q('d')];

    expect(ids(scheduleRetry(queue, 0, queue[0], [2, 3]))).toBe('A b A c d');
  });

  it('n’allonge jamais la séance au-delà du plafond', () => {
    const queue = Array.from({ length: MAX_SESSION_QUESTIONS }, (_, i) => q(`q${i}`));

    expect(scheduleRetry(queue, 0, queue[0], [2, 3])).toBe(queue);
  });

  it('pose la reprise en fin de file quand l’écart la dépasse', () => {
    const queue = [q('A'), q('b')];

    expect(ids(scheduleRetry(queue, 0, queue[0], [2, 3]))).toBe('A b A');
  });
});

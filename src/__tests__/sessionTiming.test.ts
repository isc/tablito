// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizedAverageMs } from '../lib/sessionTiming';

// Avis parent du 23/08/2026 : « il faudrait normaliser le temps de réponse
// moyen de la séance, parce que quand on met le téléphone en veille et qu'on
// fait 5 minutes de pause il ne faut pas prendre en compte ce temps abusif ».
// Les temps ci-dessous sont ceux de la séance de conjugaison du profil joint.

const SEANCE_DU_23_08 = [
  9313, 1965, 3961, 1687, 9299, 6004, 6721, 9043, 1303, 2672, 860_596, 6261,
  6287, 3313, 8144, 3807, 3064, 8386, 8677,
];

describe('normalizedAverageMs', () => {
  it('ramène la question abandonnée à la norme de la séance', () => {
    // 50 553 ms affichés au parent pour une séance jouée entre 1 et 9 s.
    const brut = Math.round(
      SEANCE_DU_23_08.reduce((a, b) => a + b, 0) / SEANCE_DU_23_08.length,
    );
    expect(brut).toBe(50_553);

    const normalise = normalizedAverageMs(SEANCE_DU_23_08);

    expect(normalise).toBe(5_748);
  });

  it('ne touche à rien quand la séance est régulière', () => {
    const times = [2_000, 3_000, 4_000, 5_000, 6_000];

    expect(normalizedAverageMs(times)).toBe(4_000);
  });

  it('laisse passer une vraie réflexion longue', () => {
    // 19 s sur une division avec reste : lent, mais réellement joué. La médiane
    // de la séance est basse, c'est le plancher de 20 s qui protège la réponse.
    const times = [3_000, 4_000, 19_000, 3_500, 4_500];

    expect(normalizedAverageMs(times)).toBe(6_800);
  });

  it('suit le tempo de l’enfant plutôt qu’une constante', () => {
    // Séance lente de bout en bout (voix, division avec reste) : 40 s y est
    // dans la norme (4 × la médiane), et n'est donc pas rabotée.
    const lente = [30_000, 35_000, 40_000, 32_000];

    expect(normalizedAverageMs(lente)).toBe(34_250);
  });

  it('remplace par la plus longue réponse NORMALE, pas par le seuil', () => {
    // Médiane 5 s → seuil 20 s ; la plus longue normale est 12 s. Les deux
    // aberrantes descendent à 12 s, pas à 20 s : elles ont bien été répondues.
    const times = [5_000, 5_000, 12_000, 300_000, 600_000];

    expect(normalizedAverageMs(times)).toBe(9_200);
  });

  it('ne touche à rien quand la séance n’a pas de norme', () => {
    // La médiane d'une valeur unique EST cette valeur : aucune aberration
    // détectable, et rien à quoi la ramener. Sans portée en pratique — une
    // séance terminée compte au moins 12 questions — mais autant que la
    // fonction dise ce qu'elle sait faire, et ce qu'elle ne sait pas.
    expect(normalizedAverageMs([600_000])).toBe(600_000);
  });

  it('renvoie 0 sans réponse', () => {
    expect(normalizedAverageMs([])).toBe(0);
  });
});

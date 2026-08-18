import type { BoxLevel, ConjFact, ConjSessionItem } from '../../types';

// Fabrique de questions de conjugaison pour les tests d'écran. Partagée par
// conjSession.test.tsx (mode clavier) et conjVoiceSession.test.tsx (mode vocal
// épelé) : deux copies de la même fabrique, c'est deux endroits à corriger le
// jour où `ConjSessionItem` gagne un champ. Ce fichier n'est pas un `*.test.ts`,
// il n'est donc pas collecté comme suite.

/**
 * Une question de la matière, par clé de fait et rang de porteuse. Les défauts
 * décrivent le cas le plus courant : un fait déjà introduit, en boîte 1, posé en
 * révision normale.
 */
export function conjItem(
  key: string,
  carrierIndex: number,
  opts: { box?: BoxLevel; isIntroduction?: boolean } = {},
): ConjSessionItem {
  const fact: ConjFact = {
    key,
    box: opts.box ?? 1,
    lastSeen: '',
    nextDue: '',
    history: [],
    introduced: !opts.isIntroduction,
  };
  return {
    kind: 'conj',
    fact,
    carrierIndex,
    isIntroduction: opts.isIntroduction ?? false,
    isRetry: false,
    isBonusReview: false,
  };
}

import type { DivisionFact } from '../types';

export interface DivisionStrategy {
  title: string;
  lines: string[];
}

/**
 * Stratégie « pense à la multiplication » (specs §11.4).
 *
 * Contrairement aux stratégies multiplicatives (lib/strategies.ts), il n'y a
 * qu'une seule stratégie, toujours applicable : la division se résout en
 * cherchant le facteur manquant dans la table déjà maîtrisée. C'est le cœur
 * de l'introduction d'un fait de division, pas un bonus — la recherche montre
 * que les enfants n'exploitent pas spontanément la relation d'inversion
 * (Robinson & Dubé 2009), il faut donc l'expliciter.
 */
export function getDivisionStrategy(fact: DivisionFact): DivisionStrategy {
  const { dividend, divisor, quotient } = fact;
  return {
    title: 'Pense à la multiplication',
    lines: [
      `${dividend} ÷ ${divisor}, c'est : ${divisor} fois combien font ${dividend} ?`,
      `${divisor} × ${quotient} = ${dividend}`,
      `Donc ${dividend} ÷ ${divisor} = ${quotient}.`,
    ],
  };
}

import type { DivisionFact } from '../types';
import { getDivisionStrategyText } from '../i18n/strategies';

export interface DivisionStrategy {
  title: string;
  // Question en toutes lettres : « 56 ÷ 7, c'est : 7 fois combien font 56 ? ».
  intro: string;
  // Pivot pédagogique : l'équation à facteur manquant « divisor × ☐ = dividend ».
  // C'est l'enfant qui retrouve le facteur (le quotient) — d'où divisor/dividend
  // exposés pour le rendu de la case, le quotient n'apparaissant qu'en conclusion.
  divisor: number;
  dividend: number;
  quotient: number;
  // Conclusion : « Donc 56 ÷ 7 = 8. ».
  conclusion: string;
}

/**
 * Stratégie « pense à la multiplication » (specs §11.4).
 *
 * Contrairement aux stratégies multiplicatives (lib/strategies.ts), il n'y a
 * qu'une seule stratégie, toujours applicable : la division se résout en
 * cherchant le facteur manquant dans la table déjà maîtrisée. C'est le cœur
 * de l'introduction d'un fait de division, pas un bonus — la recherche montre
 * que les enfants n'exploitent pas spontanément la relation d'inversion
 * (Robinson & Dubé 2009), il faut donc l'expliciter. La représentation
 * recommandée (Van de Walle ; ORIGO « think-multiplication ») présente les deux
 * formes côte à côte : la division ET l'équation à facteur manquant
 * « divisor × ☐ = dividend » — celle que le composant met en avant.
 */
export function getDivisionStrategy(fact: DivisionFact): DivisionStrategy {
  const { dividend, divisor, quotient } = fact;
  const text = getDivisionStrategyText();
  return {
    title: text.title,
    intro: text.intro(dividend, divisor),
    divisor,
    dividend,
    quotient,
    conclusion: text.conclusion(dividend, divisor, quotient),
  };
}

/**
 * Erreur de signe (specs §11.6) : l'enfant a MULTIPLIÉ les deux nombres affichés
 * au lieu de diviser — 27 pour 9 ÷ 3, 32 pour 8 ÷ 4. Ce n'est pas un fait
 * oublié mais une lecture d'opération ratée, typique des séances qui
 * entrelacent × et ÷ : le calcul est juste, c'est le signe qui a échappé.
 *
 * Sans ambiguïté possible avec la bonne réponse : diviseur ≥ 2 dans tout
 * l'inventaire, donc dividende × diviseur > dividende ≥ quotient.
 */
export function isMultiplicationSlip(fact: DivisionFact, value: number): boolean {
  return value === fact.dividend * fact.divisor;
}

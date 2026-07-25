import type { RemainderSessionQuestion } from '../types';
import { remainderDividend } from '../types';
import { getRemainderStrategyText } from '../i18n/strategies';

export interface RemainderStrategy {
  title: string;
  // Question en toutes lettres : « 45 ÷ 7, c'est : 7 fois combien font
  // presque 45, sans dépasser ? ».
  intro: string;
  // Pivot pédagogique : l'équation à ENCADREMENT « divisor × ☐ ≤ dividend »
  // (specs §12.4) — prolongement direct de l'équation à facteur manquant du
  // niveau 2. C'est l'enfant qui retrouve le plus grand facteur qui tient.
  divisor: number;
  dividend: number;
  quotient: number;
  remainder: number;
  // Conclusion : l'égalité euclidienne, « 45 = 7 × 6 + 3. Donc … reste 3. »
  conclusion: string;
}

/**
 * Stratégie « cherche le multiple juste en dessous » (specs §12.4).
 *
 * Comme au niveau 2, une seule stratégie, toujours applicable, et enseignée
 * explicitement : même avec une bonne fluence, les enfants n'exploitent pas
 * spontanément la relation d'inversion (Robinson & Dubé 2009) — a fortiori
 * l'encadrement. La question porte la zone ET le reste tiré : la stratégie se
 * calcule donc sur la question, pas sur le fait seul.
 */
export function getRemainderStrategy(
  question: Pick<RemainderSessionQuestion, 'fact' | 'remainder'>,
): RemainderStrategy {
  const { divisor, quotient } = question.fact;
  const dividend = remainderDividend(question);
  const text = getRemainderStrategyText();
  return {
    title: text.title,
    intro: text.intro(dividend, divisor),
    divisor,
    dividend,
    quotient,
    remainder: question.remainder,
    conclusion: text.conclusion(dividend, divisor, quotient, question.remainder),
  };
}

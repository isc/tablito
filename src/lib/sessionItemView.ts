import type { SessionItem } from '../types';
import { remainderDividend } from '../types';

// Dérivation d'affichage d'une question, partagée par SessionScreen (énoncé)
// et FeedbackOverlay (rappel de la question dans le feedback) : un seul
// endroit décide de « ce qui s'affiche à gauche/droite de l'opérateur » pour
// chaque type de question. Les préoccupations propres à chaque écran (seuils,
// clés TTS, réponse composée, grille) restent chez leurs consommateurs.
export interface ItemDisplay {
  left: number;
  op: '×' | '÷';
  right: number;
}

export function itemDisplay(item: SessionItem): ItemDisplay {
  if (item.kind === 'rem') {
    return { left: remainderDividend(item), op: '÷', right: item.fact.divisor };
  }
  if (item.kind === 'div') {
    return { left: item.fact.dividend, op: '÷', right: item.fact.divisor };
  }
  return { left: item.displayA, op: '×', right: item.displayB };
}

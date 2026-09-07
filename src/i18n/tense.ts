// Nom affichable d'un temps de conjugaison, par langue. Vit à part parce que
// deux modules le lisent depuis des mondes différents : `i18n/badges.ts`, qui
// est bilingue, et `i18n/conjugation.ts`, dont l'en-tête dit qu'il est FR
// SEULEMENT à dessein. Loger la table dans l'un ou l'autre revenait à mettre la
// ligne `fr` dans le module monolingue et la ligne `en` ailleurs — un concept,
// deux domiciles, et deux orthographes le jour où l'un bouge. (Loger la table
// dans `conjugation.ts` était de toute façon exclu : `scripts/generate-tts.mjs`
// charge ce module-là via `importTs`, qui interdit les imports runtime.)
//
// Les écrans de la matière indexent `.fr` en clair : la conjugaison est fr-only,
// autant que le point d'appel le dise.

import type { Lang } from './lang';
import type { ConjTense } from '../types';

export const TENSE_NAMES: Record<Lang, Record<ConjTense, string>> = {
  fr: { present: 'présent', imparfait: 'imparfait', futur: 'futur' },
  // La matière est fr-only : cette ligne existe pour que la table reste totale
  // (les badges de conjugaison sont masqués quand l'interface est en anglais).
  en: { present: 'present', imparfait: 'imperfect', futur: 'future' },
};

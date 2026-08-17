import type { ConjPerson } from '../types';
import { regularStem, type ConjQuestionView } from './conjugationFacts';

// === Les règles de la conjugaison (spec Verbito §3.2) ===
//
// Exactement le statut de ×1 et ×10 dans Tablito : les régularités massives
// sont ENSEIGNÉES comme des règles, avec leur écran d'introduction, et ne sont
// jamais mémorisées fait par fait. Ce sont les anchor facts de la conjugaison :
// tout le reste s'y raccroche.
//
// Textes en français uniquement : la matière conjugaison est fr-only (masquée
// quand la langue d'interface est l'anglais), donc pas de table { fr, en } —
// contrairement aux stratégies mathématiques de i18n/strategies.ts.

export type ConjStrategyKind =
  | 'person-marks'
  | 'imparfait-nous'
  | 'futur-infinitif'
  | 'son-doux';

export interface ConjStrategy {
  kind: ConjStrategyKind;
  title: string;
  /**
   * Énoncé côté enfant : phrases courtes, une idée par ligne. Mini-balisage
   * rendu par `renderConjHintLine` (components/conjHintLine.tsx) : `*ons*` = terminaison dans
   * la couleur des marques, `_chant_` = radical dans celle des radicaux — les
   * mêmes couleurs que la forme segmentée affichée au-dessus de l'astuce.
   */
  lines: readonly string[];
}

/**
 * Les marques de personne, quasi invariantes à travers les temps (§3.2).
 *
 * Aucun exemple pris dans la famille sont / ont / vont / font : cette astuce
 * s'affiche en feedback d'un fait en boîte ≤ 2, donc au moment précis où ces
 * quatre monosyllabes ne sont pas encore consolidés — et le §3.4 réserve leur
 * air de famille à l'APRÈS-maîtrise (« donné trop tôt, il fabrique la confusion
 * qu'il prétend expliquer »).
 */
export const PERSON_MARKS: ConjStrategy = {
  kind: 'person-marks',
  title: 'Chaque personne a sa marque',
  lines: [
    'Avec tu, ça finit presque toujours par *s* : tu chante*s*, tu va*s*, tu dira*s*.',
    'Avec nous, ça finit par *ons* : nous chant*ons*, nous all*ons*, nous éti*ons*.',
    'Avec vous, ça finit par *ez* : vous chant*ez*, vous ven*ez*, vous verr*ez*.',
    'Avec ils et elles, ça finit par *nt* : ils chante*nt*, ils jouaie*nt*, ils viendro*nt*.',
    'Trois formes n’obéissent pas : vous *êtes*, vous *faites*, vous *dites*. Et une quatrième : nous *sommes*.',
  ],
};

/** L'imparfait se FABRIQUE — 6 terminaisons pour toute la langue (§3.2). */
export const IMPARFAIT_RULE: ConjStrategy = {
  kind: 'imparfait-nous',
  title: 'L’imparfait se fabrique avec « nous »',
  lines: [
    'Dis le verbe avec nous, au présent : nous _chant_*ons*.',
    'Enlève *-ons* : il reste _chant_.',
    'Ajoute la terminaison : *ais*, *ais*, *ait*, *ions*, *iez*, *aient*.',
    'Ça donne : je _chant_*ais*, nous _chant_*ions*, ils _chant_*aient*.',
    'Ça marche pour tous les verbes… sauf être : j’_ét_*ais*, nous _ét_*ions*.',
  ],
};

/** Le futur se FABRIQUE — infinitif + terminaisons (§3.2). */
export const FUTUR_RULE: ConjStrategy = {
  kind: 'futur-infinitif',
  title: 'Le futur se fabrique avec l’infinitif',
  lines: [
    'Prends le verbe en entier : _chanter_.',
    'Ajoute la terminaison : *ai*, *as*, *a*, *ons*, *ez*, *ont*.',
    'Ça donne : je _chanter_*ai*, nous _chanter_*ons*, ils _chanter_*ont*.',
    'Pour les verbes en -re comme dire, on enlève le e : je _dir_*ai*.',
    'Six verbes changent de début : être → _ser_, avoir → _aur_, aller → _ir_, faire → _fer_, venir → _viendr_, voir → _verr_.',
  ],
};

/** Les pièges de son : -geons, -çons (§3.2). */
export const SON_DOUX_RULE: ConjStrategy = {
  kind: 'son-doux',
  title: 'Le piège du g et du c',
  lines: [
    'Devant a, o, u, le g et le c changent de son.',
    'Pour garder le son doux, on écrit nous mang*eons*, avec un e.',
    'Pareil à l’imparfait : je mang*eais*, ils mang*eaient*.',
    'Mais devant i, pas besoin du e : nous mang*ions*.',
    'Avec un c, on met une cédille : nous lan*çons*.',
  ],
};

export const CONJ_STRATEGIES: readonly ConjStrategy[] = [
  PERSON_MARKS,
  IMPARFAIT_RULE,
  FUTUR_RULE,
  SON_DOUX_RULE,
];

/**
 * Marque régulière de la personne (§3.2), ou null quand la personne n'en porte
 * pas (je, il). Sert au feedback : « le pronom et sa marque s'illuminent ».
 */
export function personMark(person: ConjPerson): string | null {
  switch (person) {
    case 'tu':
      return 's';
    case 'nous':
      return 'ons';
    case 'vous':
      return 'ez';
    case 'ils':
      return 'nt';
    default:
      return null;
  }
}

/**
 * L'astuce à afficher pour une question donnée (§5.3 : seulement pour les faits
 * en boîte ≤ 2). Une seule règle à la fois — jamais un mur de règles.
 *
 * Priorité au piège de son quand il s'applique : c'est LUI qui vient de faire
 * rater la question (le radical affiché a changé sous les doigts de l'enfant),
 * pas la règle générale du temps.
 */
export function getConjStrategy(view: ConjQuestionView): ConjStrategy {
  // Le radical affiché a-t-il été raboté par l'euphonie (man|geons) ?
  const euphonyApplies =
    view.def.kind === 'ending' && view.segment[0] !== regularStem(view.verb, view.def.tense);
  if (euphonyApplies) return SON_DOUX_RULE;
  if (view.def.tense === 'imparfait') return IMPARFAIT_RULE;
  if (view.def.tense === 'futur') return FUTUR_RULE;
  return PERSON_MARKS;
}

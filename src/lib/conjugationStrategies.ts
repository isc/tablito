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
  /** Énoncé côté enfant : phrases courtes, une idée par ligne. */
  lines: readonly string[];
}

/** Les marques de personne, quasi invariantes à travers les temps (§3.2). */
export const PERSON_MARKS: ConjStrategy = {
  kind: 'person-marks',
  title: 'Chaque personne a sa marque',
  lines: [
    'Avec tu, ça finit presque toujours par s : tu chantes, tu vas, tu diras.',
    'Avec nous, ça finit par ons : nous chantons, nous allons, nous étions.',
    'Avec vous, ça finit par ez : vous chantez, vous venez, vous verrez.',
    'Avec ils et elles, ça finit par nt : ils chantent, ils font, ils viendront.',
    'Trois formes n’obéissent pas : vous êtes, vous faites, vous dites. Et une quatrième : nous sommes.',
  ],
};

/** L'imparfait se FABRIQUE — 6 terminaisons pour toute la langue (§3.2). */
export const IMPARFAIT_RULE: ConjStrategy = {
  kind: 'imparfait-nous',
  title: 'L’imparfait se fabrique avec « nous »',
  lines: [
    'Dis le verbe avec nous, au présent : nous chantons.',
    'Enlève -ons : il reste chant.',
    'Ajoute la terminaison : ais, ais, ait, ions, iez, aient.',
    'Ça donne : je chantais, nous chantions, ils chantaient.',
    'Ça marche pour tous les verbes… sauf être : j’étais, nous étions.',
  ],
};

/** Le futur se FABRIQUE — infinitif + terminaisons (§3.2). */
export const FUTUR_RULE: ConjStrategy = {
  kind: 'futur-infinitif',
  title: 'Le futur se fabrique avec l’infinitif',
  lines: [
    'Prends le verbe en entier : chanter.',
    'Ajoute la terminaison : ai, as, a, ons, ez, ont.',
    'Ça donne : je chanterai, nous chanterons, ils chanteront.',
    'Pour les verbes en -re comme dire, on enlève le e : je dirai.',
    'Six verbes changent de début : être → ser, avoir → aur, aller → ir, faire → fer, venir → viendr, voir → verr.',
  ],
};

/** Les pièges de son : -geons, -çons (§3.2). */
export const SON_DOUX_RULE: ConjStrategy = {
  kind: 'son-doux',
  title: 'Le piège du g et du c',
  lines: [
    'Devant a, o, u, le g et le c changent de son.',
    'Pour garder le son doux, on écrit nous mangeons, avec un e.',
    'Pareil à l’imparfait : je mangeais, ils mangeaient.',
    'Mais devant i, pas besoin du e : nous mangions.',
    'Avec un c, on met une cédille : nous lançons.',
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

import type { ConjFact } from '../types';
import {
  conjFactDef,
  regularStem,
  resolveConjQuestion,
  type ConjQuestionView,
} from './conjugationFacts';

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

export interface ConjStrategy {
  title: string;
  /**
   * Vignette de la règle sur l'écran « Mes règles », l'équivalent du « ×10 »
   * des règles de maths : la marque qui la résume, dans le même mini-balisage
   * que `lines` — la vignette se lit dans les couleurs de la forme segmentée.
   */
  badge: string;
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
const PERSON_MARKS: ConjStrategy = {
  title: 'Chaque personne a sa marque',
  badge: '*ons*',
  lines: [
    'Avec tu, ça finit presque toujours par *s* : tu chante*s*, tu va*s*, tu dira*s*.',
    'Avec nous, ça finit par *ons* : nous chant*ons*, nous all*ons*, nous éti*ons*.',
    'Avec vous, ça finit par *ez* : vous chant*ez*, vous ven*ez*, vous verr*ez*.',
    'Avec ils et elles, ça finit par *nt* : ils chante*nt*, ils jouaie*nt*, ils viendro*nt*.',
    'Trois formes n’obéissent pas : vous *êtes*, vous *faites*, vous *dites*. Et une quatrième : nous *sommes*.',
  ],
};

/** L'imparfait se FABRIQUE — 6 terminaisons pour toute la langue (§3.2). */
const IMPARFAIT_RULE: ConjStrategy = {
  title: 'L’imparfait se fabrique avec « nous »',
  badge: '*ais*',
  lines: [
    'Dis le verbe avec nous, au présent : nous _chant_*ons*.',
    'Enlève *-ons* : il reste _chant_.',
    'Ajoute la terminaison : *ais*, *ais*, *ait*, *ions*, *iez*, *aient*.',
    'Ça donne : je _chant_*ais*, nous _chant_*ions*, ils _chant_*aient*.',
    'Ça marche pour tous les verbes… sauf être : j’_ét_*ais*, nous _ét_*ions*.',
  ],
};

/** Le futur se FABRIQUE — infinitif + terminaisons (§3.2). */
const FUTUR_RULE: ConjStrategy = {
  title: 'Le futur se fabrique avec l’infinitif',
  // Le r appartient au radical (l'infinitif gardé entier), seul « ai » est la
  // terminaison : la vignette dit la règle par ses deux couleurs.
  badge: '_r_*ai*',
  lines: [
    'Prends le verbe en entier : _chanter_.',
    'Ajoute la terminaison : *ai*, *as*, *a*, *ons*, *ez*, *ont*.',
    'Ça donne : je _chanter_*ai*, nous _chanter_*ons*, ils _chanter_*ont*.',
    'Pour les verbes en -re comme dire, on enlève le e : je _dir_*ai*.',
    'Six verbes changent de début : être → _ser_, avoir → _aur_, aller → _ir_, faire → _fer_, venir → _viendr_, voir → _verr_.',
  ],
};

/** Les pièges de son : -geons, -çons (§3.2). */
const SON_DOUX_RULE: ConjStrategy = {
  title: 'Le piège du g et du c',
  // Le g, et le e qu'on lui ajoute — seul en couleur de marque, comme dans
  // les lignes ci-dessous (mang*eons*).
  badge: 'g*e*',
  lines: [
    'Devant a, o, u, le g et le c changent de son.',
    'Pour garder le son doux, on écrit nous mang*eons*, avec un e.',
    'Pareil à l’imparfait : je mang*eais*, ils mang*eaient*.',
    'Mais devant i, pas besoin du e : nous mang*ions*.',
    'Avec un c, on met une cédille : nous lan*çons*.',
  ],
};

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

/**
 * Les règles de la matière, dans l'ordre de l'écran « Mes règles » — celui de
 * la spec (§15.3) : les marques de personne, ancre de tout le reste, puis la
 * fabrication des temps dans l'ordre du programme, et le piège de son, règle
 * annexe, en dernier.
 */
export const CONJ_RULES: readonly ConjStrategy[] = [
  PERSON_MARKS,
  IMPARFAIT_RULE,
  FUTUR_RULE,
  SON_DOUX_RULE,
];

/**
 * Les règles que l'enfant a déjà rencontrées, dans l'ordre de `CONJ_RULES` :
 * celles que la séance montre (introduction, correction) pour au moins un fait
 * déjà introduit — par une introduction, ou par le test de placement.
 *
 * L'écran « Mes règles » les révèle ainsi au fil de la matière — pourquoi, et
 * ce que ça garantit pour l'interférence futur -ai / imparfait -ais : spec
 * §15.3.
 *
 * Dérivé de `getConjStrategy`, jamais d'une table à part : une règle est listée
 * exactement quand la séance l'afficherait pour un fait de l'enfant. Un test
 * vérifie que `CONJ_RULES` contient toutes celles que la séance peut montrer.
 */
export function metConjRules(facts: readonly Pick<ConjFact, 'key' | 'introduced'>[]): ConjStrategy[] {
  const met = new Set<ConjStrategy>();
  for (const fact of facts) {
    if (!fact.introduced) continue;
    const def = conjFactDef(fact.key);
    if (!def) continue;
    // Toutes les porteuses : « ils mangeaient » appelle le piège du g et du c,
    // les deux autres phrases du même fait la règle de l'imparfait.
    def.carriers.forEach((_, i) => met.add(getConjStrategy(resolveConjQuestion(def, i))));
  }
  return CONJ_RULES.filter((rule) => met.has(rule));
}

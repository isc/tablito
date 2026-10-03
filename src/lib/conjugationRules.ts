import type { ConjPerson } from '../types';

// === Les règles de la conjugaison (spec Verbito §3.2, §15.3) ===
//
// Exactement le statut de ×1 et ×10 dans Tablito : les régularités massives
// sont ENSEIGNÉES comme des règles, avec leur écran d'introduction, et ne sont
// jamais mémorisées fait par fait. Ce sont les anchor facts de la conjugaison :
// tout le reste s'y raccroche.
//
// Données seules, sans aucun import runtime : scripts/generate-tts.mjs charge ce
// module avec `importTs` (transformation fichier à fichier) pour générer le MP3
// de chaque règle depuis `speech`, jamais depuis une copie. La sélection de la
// règle d'une question vit à côté, dans conjugationStrategies.ts.
//
// Textes en français uniquement : la matière conjugaison est fr-only (masquée
// quand la langue d'interface est l'anglais), donc pas de table { fr, en } —
// contrairement aux stratégies mathématiques de i18n/strategies.ts.
//
// Mini-balisage de tous les textes de forme (`badge`, `lines`, et les `form`,
// `forms`, `example` des blocs), rendu par `renderConjHintLine`
// (components/conjHintLine.tsx) dans les couleurs de la forme segmentée :
//   `*ons*`  terminaison (grenat)        `_chant_`  radical (bleu)
//   `^ais^`  terminaison illuminée, la pastille de la forme segmentée
//   `~ons~`  lettres qu'on enlève, barrées

/** Une ligne du tableau des marques : un pronom, sa marque, un exemple. */
export interface ConjMarkRow {
  /** La personne de la ligne : la séance illumine celle de la question. */
  person: ConjPerson;
  pronoun: string;
  mark: string;
  example: string;
}

/** Un bloc visuel de la règle (cf. `blocks` et `more` de `ConjStrategy`). */
export type ConjRuleBlock =
  /** Le tableau pronom → marque → exemple. */
  | { kind: 'marks'; rows: readonly ConjMarkRow[] }
  /** La recette, en étapes numérotées. */
  | { kind: 'steps'; steps: readonly { label: string; form: string }[] }
  /** Le temps conjugué en entier, dans l'ordre je, tu, il, nous, vous, ils. */
  | { kind: 'table'; label: string; forms: readonly string[] }
  /** Des formes posées côte à côte (les exceptions). */
  | { kind: 'chips'; label: string; forms: readonly string[] }
  /** Un cas à part, en une ligne. */
  | { kind: 'note'; label: string; form: string }
  /** Une forme en grand, et ce qu'il faut y voir. */
  | { kind: 'spotlight'; form: string; caption: string }
  /** Des colonnes de formes, chacune sous son titre. */
  | { kind: 'columns'; columns: readonly { label: string; forms: readonly string[] }[] };

export interface ConjStrategy {
  /** Identifiant stable : le MP3 de la règle est `conj-rule-<id>`. */
  id: string;
  title: string;
  /**
   * Vignette de la règle sur l'écran « Mes règles », l'équivalent du « ×10 »
   * des règles de maths : la marque qui la résume.
   */
  badge: string;
  /**
   * Le cœur de la règle en images, montré partout : l'astuce de la séance
   * (introduction d'un fait, correction) n'a que lui — une seule idée à la
   * fois, jamais un mur de règle.
   */
  blocks: readonly ConjRuleBlock[];
  /** Les blocs que l'écran « Mes règles » ajoute sous le cœur. */
  more?: readonly ConjRuleBlock[];
  /** Mot de la fin sous les blocs, sur l'écran « Mes règles ». */
  tip?: string;
  /**
   * La règle écrite en entier, phrases courtes, une idée par ligne : dépliable
   * sous les blocs de l'écran « Mes règles », pour qui veut la lire.
   */
  lines: readonly string[];
  /**
   * Le texte du MP3 `conj-rule-<id>` (bouton « Écouter »). Écrit pour l'oreille :
   * les terminaisons y sont ÉPELÉES (« o, n, s ») — muettes pour la plupart,
   * elles ne s'entendent pas dans la forme lue.
   */
  speech: string;
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
  id: 'marks',
  title: 'Chaque personne a sa marque',
  badge: '*ons*',
  blocks: [
    {
      kind: 'marks',
      rows: [
        { person: 'tu', pronoun: 'tu', mark: 's', example: 'tu chante*s*' },
        { person: 'nous', pronoun: 'nous', mark: 'ons', example: 'nous chant*ons*' },
        { person: 'vous', pronoun: 'vous', mark: 'ez', example: 'vous chant*ez*' },
        { person: 'ils', pronoun: 'ils, elles', mark: 'nt', example: 'ils chante*nt*' },
      ],
    },
    // Les rebelles restent dans l'astuce de la séance : elle s'affiche aussi
    // pour les formes irrégulières du présent, où le tableau seul contredirait
    // la réponse (vous *êtes*, pas vous *-ez*).
    {
      kind: 'chips',
      label: 'Les 4 rebelles',
      forms: ['vous *êtes*', 'vous *faites*', 'vous *dites*', 'nous *sommes*'],
    },
  ],
  tip: 'Au présent, à l’imparfait, au futur : la marque ne bouge presque pas.',
  lines: [
    'Avec tu, ça finit presque toujours par *s* : tu chante*s*, tu va*s*, tu dira*s*.',
    'Avec nous, ça finit par *ons* : nous chant*ons*, nous all*ons*, nous éti*ons*.',
    'Avec vous, ça finit par *ez* : vous chant*ez*, vous ven*ez*, vous verr*ez*.',
    'Avec ils et elles, ça finit par *nt* : ils chante*nt*, ils jouaie*nt*, ils viendro*nt*.',
    'Trois formes n’obéissent pas : vous *êtes*, vous *faites*, vous *dites*. Et une quatrième : nous *sommes*.',
  ],
  speech:
    'Chaque personne a sa marque. ' +
    'Avec tu, ça finit presque toujours par la lettre s : tu chantes. ' +
    'Avec nous, ça finit par o, n, s : nous chantons. ' +
    'Avec vous, ça finit par e, z : vous chantez. ' +
    'Avec ils et elles, ça finit par n, t : ils chantent. ' +
    'Attention, quatre formes n’obéissent pas : vous êtes, vous faites, vous dites, et nous sommes.',
};

/** L'imparfait se FABRIQUE — 6 terminaisons pour toute la langue (§3.2). */
export const IMPARFAIT_RULE: ConjStrategy = {
  id: 'imparfait',
  title: 'L’imparfait se fabrique avec « nous »',
  badge: '*ais*',
  blocks: [
    {
      kind: 'steps',
      steps: [
        { label: 'Dis-le avec nous', form: 'nous _chant_*ons*' },
        { label: 'Enlève -ons', form: '_chant_~ons~' },
        // La personne change ici, et l'étiquette le dit : passer de « nous » à
        // « je » sans prévenir laissait croire à une étape manquée.
        { label: 'Choisis la personne, ajoute sa terminaison', form: 'je _chant_^ais^' },
      ],
    },
  ],
  more: [
    {
      kind: 'table',
      label: 'Les 6 terminaisons',
      forms: [
        'je _chant_*ais*',
        'tu _chant_*ais*',
        'il _chant_*ait*',
        'nous _chant_*ions*',
        'vous _chant_*iez*',
        'ils _chant_*aient*',
      ],
    },
    { kind: 'note', label: 'Sauf être', form: 'j’_ét_*ais*, nous _ét_*ions*' },
  ],
  tip: 'Ça marche pour tous les verbes !',
  lines: [
    'Dis le verbe avec nous, au présent : nous _chant_*ons*.',
    'Enlève *-ons* : il reste _chant_.',
    'Ajoute la terminaison : *ais*, *ais*, *ait*, *ions*, *iez*, *aient*.',
    'Ça donne : je _chant_*ais*, nous _chant_*ions*, ils _chant_*aient*.',
    'Ça marche pour tous les verbes… sauf être : j’_ét_*ais*, nous _ét_*ions*.',
  ],
  speech:
    'L’imparfait se fabrique avec nous. ' +
    'Un : dis le verbe avec nous, au présent : nous chantons. ' +
    'Deux : enlève o, n, s. Il reste chant. ' +
    'Trois : choisis la personne, et ajoute sa terminaison. ' +
    'Je chantais, avec a, i, s. Nous chantions, avec i, o, n, s. Ils chantaient, avec a, i, e, n, t. ' +
    'Ça marche pour tous les verbes, sauf être : j’étais.',
};

/** Le futur se FABRIQUE — infinitif + terminaisons (§3.2). */
export const FUTUR_RULE: ConjStrategy = {
  id: 'futur',
  title: 'Le futur se fabrique avec l’infinitif',
  // Le r appartient au radical (l'infinitif gardé entier), seul « ai » est la
  // terminaison : la vignette dit la règle par ses deux couleurs.
  badge: '_r_*ai*',
  blocks: [
    {
      kind: 'steps',
      steps: [
        { label: 'Prends le verbe en entier', form: '_chanter_' },
        { label: 'Choisis la personne, ajoute sa terminaison', form: 'je _chanter_^ai^' },
      ],
    },
  ],
  more: [
    {
      kind: 'table',
      label: 'Les 6 terminaisons',
      forms: [
        'je _chanter_*ai*',
        'tu _chanter_*as*',
        'il _chanter_*a*',
        'nous _chanter_*ons*',
        'vous _chanter_*ez*',
        'ils _chanter_*ont*',
      ],
    },
    { kind: 'note', label: 'Verbes en -re', form: 'dir~e~ → je _dir_*ai*' },
    {
      kind: 'chips',
      label: '6 verbes changent de début',
      forms: [
        'être → je _ser_*ai*',
        'avoir → j’_aur_*ai*',
        'aller → j’_ir_*ai*',
        'faire → je _fer_*ai*',
        'venir → je _viendr_*ai*',
        'voir → je _verr_*ai*',
      ],
    },
  ],
  lines: [
    'Prends le verbe en entier : _chanter_.',
    'Ajoute la terminaison : *ai*, *as*, *a*, *ons*, *ez*, *ont*.',
    'Ça donne : je _chanter_*ai*, nous _chanter_*ons*, ils _chanter_*ont*.',
    'Pour les verbes en -re comme dire, on enlève le e : je _dir_*ai*.',
    'Six verbes changent de début : être → _ser_, avoir → _aur_, aller → _ir_, faire → _fer_, venir → _viendr_, voir → _verr_.',
  ],
  speech:
    'Le futur se fabrique avec l’infinitif. ' +
    'Un : prends le verbe en entier : chanter. ' +
    'Deux : choisis la personne, et ajoute sa terminaison. ' +
    'Je chanterai, avec a, i. Nous chanterons, avec o, n, s. Ils chanteront, avec o, n, t. ' +
    'Pour les verbes en r, e, comme dire, on enlève le e : je dirai. ' +
    'Et six verbes changent de début : je serai, j’aurai, j’irai, je ferai, je viendrai, je verrai.',
};

/** Les pièges de son : -geons, -çons (§3.2). */
export const SON_DOUX_RULE: ConjStrategy = {
  id: 'son-doux',
  title: 'Le piège du g et du c',
  // Le g, et le e qu'on lui ajoute — seul en couleur de marque, comme dans
  // les formes ci-dessous (mang*eons*).
  badge: 'g*e*',
  blocks: [
    { kind: 'spotlight', form: 'nous _mang_^e^*ons*', caption: 'Le e garde le son doux de manger.' },
    {
      kind: 'columns',
      columns: [
        { label: 'Avec un e', forms: ['je _mang_*eais*', 'ils _mang_*eaient*'] },
        { label: 'Devant i, pas de e', forms: ['nous _mang_*ions*'] },
      ],
    },
  ],
  more: [{ kind: 'spotlight', form: 'nous _lan_^ç^*ons*', caption: 'Avec un c : la cédille.' }],
  lines: [
    'Devant a, o, u, le g et le c changent de son.',
    'Pour garder le son doux, on écrit nous mang*eons*, avec un e.',
    'Pareil à l’imparfait : je mang*eais*, ils mang*eaient*.',
    'Mais devant i, pas besoin du e : nous mang*ions*.',
    'Avec un c, on met une cédille : nous lan*çons*.',
  ],
  speech:
    'Le piège du g et du c. ' +
    'Pour garder le son doux de manger, on ajoute un e après le g : nous mangeons, je mangeais. ' +
    'Mais devant i, pas besoin du e : nous mangions. ' +
    'Avec un c, on met une cédille : nous lançons.',
};

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

/** La clé du MP3 qui lit la règle (bouton « Écouter »). */
export function conjRuleTtsKey(rule: Pick<ConjStrategy, 'id'>): string {
  return `conj-rule-${rule.id}`;
}

import type { ConjFact, ConjFactKind, ConjPerson, ConjTense } from '../types';

// === Matière conjugaison — l'inventaire (spec Verbito §3) ===
//
// 63 faits, exactement l'ordre de grandeur d'un niveau de Tablito :
//   présent 1er groupe   6 terminaisons                                    →  6
//   présent irréguliers  7 verbes × 6 personnes − 4 fusions je/tu          → 38
//   imparfait            6 terminaisons + 1 radical irrégulier (ét-)       →  7
//   futur                6 terminaisons + 6 radicaux irréguliers           → 12
//
// Deux systèmes cohabitent (Pinker 1999, spec §2.1) : les RÈGLES productives
// (terminaisons, marques de personne — cf. conjugationStrategies.ts) et les
// FORMES stockées (les irréguliers fréquents). Les deux sont des faits Leitner,
// mais ils ne se tapent pas pareil (§4.2) : terminaison seule quand le radical
// est régulier et affiché, forme entière quand c'est la forme elle-même qui est
// le fait.

export const CONJ_PERSONS: readonly ConjPerson[] = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];

export const CONJ_TENSES: readonly ConjTense[] = ['present', 'imparfait', 'futur'];

// Verbes support du 1er groupe (spec §3.1) : fréquents, concrets, imageables.
// `manger` est là EXPRÈS, pour le piège orthographique « nous man|geons ».
export const CONJ_GROUP1_VERBS: readonly string[] = [
  'chanter',
  'jouer',
  'regarder',
  'aimer',
  'donner',
  'parler',
  'trouver',
  'manger',
];

// Les 7 irréguliers fréquents du programme (spec §3.1), dans l'ordre
// d'introduction (fréquence décroissante) — cet ordre pilote `conjIntroRank`.
export const CONJ_IRREGULAR_VERBS: readonly string[] = [
  'être',
  'avoir',
  'aller',
  'faire',
  'dire',
  'venir',
  'voir',
];

// Terminaisons régulières, par temps. Les deux tables imparfait/futur sont
// universelles (elles s'appliquent à TOUS les verbes du périmètre, y compris
// aux radicaux irréguliers ser-, ét-… — c'est tout l'intérêt de la
// factorisation) ; la table du présent est propre au 1er groupe.
export const CONJ_PRESENT_G1_ENDINGS: Record<ConjPerson, string> = {
  je: 'e',
  tu: 'es',
  il: 'e',
  nous: 'ons',
  vous: 'ez',
  ils: 'ent',
};

export const CONJ_IMPARFAIT_ENDINGS: Record<ConjPerson, string> = {
  je: 'ais',
  tu: 'ais',
  il: 'ait',
  nous: 'ions',
  vous: 'iez',
  ils: 'aient',
};

export const CONJ_FUTUR_ENDINGS: Record<ConjPerson, string> = {
  je: 'ai',
  tu: 'as',
  il: 'a',
  nous: 'ons',
  vous: 'ez',
  ils: 'ont',
};

export function conjEndings(tense: ConjTense): Record<ConjPerson, string> {
  if (tense === 'imparfait') return CONJ_IMPARFAIT_ENDINGS;
  if (tense === 'futur') return CONJ_FUTUR_ENDINGS;
  return CONJ_PRESENT_G1_ENDINGS;
}

const TENSE_SLUG: Record<ConjTense, string> = {
  present: 'pres',
  imparfait: 'imp',
  futur: 'fut',
};

/** Retire les diacritiques : « être » → « etre » (clés et comparaisons). */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// --- Phrases porteuses (spec §4.1) -----------------------------------------
//
// Une phrase porteuse est TOUJOURS de la forme
//   « <marqueur temporel>, <pronom><forme> <suite> »
// ce qui garantit par construction une phrase grammaticale et un marqueur
// temporel franc en tête (hier / demain / en ce moment), et permet de dériver
// mécaniquement le pronom (avec élision) de la personne.
export interface ConjCarrier {
  /** Verbe conjugué dans cette phrase (infinitif). */
  verb: string;
  /** Personne portée par cette phrase (les faits fusionnés je/tu varient). */
  person: ConjPerson;
  /** Marqueur temporel, ponctuation comprise : « Hier, ». */
  before: string;
  /** Fin de phrase, après la forme verbale : « une chanson. ». */
  after: string;
}

/**
 * Définition statique d'un fait. Vit ici, hors des profils : `ConjFact` ne
 * porte que la clé + l'état Leitner.
 */
export interface ConjFactDef {
  key: string;
  kind: ConjFactKind;
  tense: ConjTense;
  /** Verbe du fait ('irregular'/'stem') ; null pour les terminaisons. */
  verb: string | null;
  /** Personnes couvertes : 1, 2 (fusion je/tu), ou celles des porteuses. */
  persons: readonly ConjPerson[];
  /** 'ending' : la terminaison enseignée (avant euphonie). */
  ending: string | null;
  /** 'stem' : le radical irrégulier (« ser », « ét »). */
  stem: string | null;
  /** 'irregular' : la forme entière stockée (« sommes »). */
  form: string | null;
  /**
   * 'irregular' : segmentation radical|marque de personne. La marque n'est
   * renseignée que quand c'est une VRAIE marque régulière (-s, -ons, -ez, -nt,
   * -ent) ; sinon la forme entière est le « radical » et la marque est vide —
   * les exceptions (sommes, êtes, faites, dites) sont précisément les formes
   * qu'on ne peut pas décomposer, et c'est ce que la segmentation doit montrer.
   */
  segment: readonly [string, string] | null;
  carriers: readonly ConjCarrier[];
}

// --- Constructeurs ----------------------------------------------------------

type CarrierSpec = readonly [verb: string, before: string, after: string];
type PersonCarrierSpec = readonly [person: ConjPerson, before: string, after: string];

function endingFact(
  tense: ConjTense,
  person: ConjPerson,
  carriers: readonly CarrierSpec[],
): ConjFactDef {
  const key = tense === 'present' ? `pres-g1-${person}` : `${TENSE_SLUG[tense]}-${person}`;
  return {
    key,
    kind: 'ending',
    tense,
    verb: null,
    persons: [person],
    ending: conjEndings(tense)[person],
    stem: null,
    form: null,
    segment: null,
    carriers: carriers.map(([verb, before, after]) => ({ verb, person, before, after })),
  };
}

function irregularFact(
  verb: string,
  persons: readonly ConjPerson[],
  form: string,
  segment: readonly [string, string],
  carriers: readonly PersonCarrierSpec[],
): ConjFactDef {
  return {
    key: `pres-${stripAccents(verb)}-${persons.join('')}`,
    kind: 'irregular',
    tense: 'present',
    verb,
    persons,
    ending: null,
    stem: null,
    form,
    segment,
    carriers: carriers.map(([person, before, after]) => ({ verb, person, before, after })),
  };
}

function stemFact(
  tense: ConjTense,
  verb: string,
  stem: string,
  carriers: readonly PersonCarrierSpec[],
): ConjFactDef {
  return {
    key: `${TENSE_SLUG[tense]}-${stripAccents(verb)}`,
    kind: 'stem',
    tense,
    verb,
    persons: [...new Set(carriers.map(([person]) => person))],
    ending: null,
    stem,
    form: null,
    segment: null,
    carriers: carriers.map(([person, before, after]) => ({ verb, person, before, after })),
  };
}

// --- Bloc 1 — présent, 1er groupe : 6 terminaisons --------------------------

const PRESENT_G1: ConjFactDef[] = [
  endingFact('present', 'je', [
    ['chanter', 'En ce moment,', 'une chanson.'],
    ['aimer', 'Aujourd’hui,', 'ce livre.'],
    ['jouer', 'Maintenant,', 'dans le jardin.'],
  ]),
  endingFact('present', 'tu', [
    ['regarder', 'En ce moment,', 'la télé.'],
    ['donner', 'Aujourd’hui,', 'ton goûter.'],
    ['parler', 'Maintenant,', 'très fort.'],
  ]),
  endingFact('present', 'il', [
    ['trouver', 'En ce moment,', 'son sac.'],
    ['chanter', 'Aujourd’hui,', 'à l’école.'],
    ['jouer', 'Maintenant,', 'au ballon.'],
  ]),
  endingFact('present', 'nous', [
    // Le piège -geons est posé dès la première porteuse (spec §3.1).
    ['manger', 'En ce moment,', 'des crêpes.'],
    ['chanter', 'Aujourd’hui,', 'ensemble.'],
    ['regarder', 'Maintenant,', 'un film.'],
  ]),
  endingFact('present', 'vous', [
    ['parler', 'En ce moment,', 'trop vite.'],
    ['aimer', 'Aujourd’hui,', 'les gâteaux.'],
    ['trouver', 'Maintenant,', 'la solution.'],
  ]),
  endingFact('present', 'ils', [
    ['jouer', 'En ce moment,', 'aux billes.'],
    ['donner', 'Aujourd’hui,', 'leurs dessins.'],
    ['chanter', 'Maintenant,', 'très fort.'],
  ]),
];

// --- Bloc 2 — présent, irréguliers : 38 faits -------------------------------
//
// 7 verbes × 6 personnes = 42 formes, moins les 4 fusions je/tu (fais, dis,
// viens, vois) : quand je et tu partagent la même forme ÉCRITE, c'est un seul
// fait dont les porteuses varient le pronom — exactement la fusion des paires
// commutatives 3×4/4×3 côté multiplication (spec §3.3).

const PRESENT_ETRE: ConjFactDef[] = [
  irregularFact('être', ['je'], 'suis', ['suis', ''], [
    ['je', 'Aujourd’hui,', 'en retard.'],
    ['je', 'En ce moment,', 'à la maison.'],
  ]),
  irregularFact('être', ['tu'], 'es', ['e', 's'], [
    ['tu', 'Aujourd’hui,', 'très gentil.'],
    ['tu', 'En ce moment,', 'dans la cour.'],
  ]),
  irregularFact('être', ['il'], 'est', ['est', ''], [
    ['il', 'Aujourd’hui,', 'malade.'],
    ['il', 'En ce moment,', 'au tableau.'],
  ]),
  // « sommes » : l'exception à nous → -ons, insécable (spec §3.2).
  irregularFact('être', ['nous'], 'sommes', ['sommes', ''], [
    ['nous', 'Aujourd’hui,', 'huit à table.'],
    ['nous', 'En ce moment,', 'en vacances.'],
  ]),
  // « êtes » : l'exception à vous → -ez.
  irregularFact('être', ['vous'], 'êtes', ['êtes', ''], [
    ['vous', 'Aujourd’hui,', 'les premiers.'],
    ['vous', 'En ce moment,', 'très sages.'],
  ]),
  irregularFact('être', ['ils'], 'sont', ['so', 'nt'], [
    ['ils', 'Aujourd’hui,', 'à la piscine.'],
    ['ils', 'En ce moment,', 'dehors.'],
  ]),
];

const PRESENT_AVOIR: ConjFactDef[] = [
  irregularFact('avoir', ['je'], 'ai', ['ai', ''], [
    ['je', 'Aujourd’hui,', 'faim.'],
    ['je', 'En ce moment,', 'très soif.'],
  ]),
  irregularFact('avoir', ['tu'], 'as', ['a', 's'], [
    ['tu', 'Aujourd’hui,', 'de la chance.'],
    ['tu', 'En ce moment,', 'mal au bras.'],
  ]),
  irregularFact('avoir', ['il'], 'a', ['a', ''], [
    ['il', 'Aujourd’hui,', 'un nouveau vélo.'],
    ['il', 'En ce moment,', 'peur du noir.'],
  ]),
  irregularFact('avoir', ['nous'], 'avons', ['av', 'ons'], [
    ['nous', 'Aujourd’hui,', 'piscine.'],
    ['nous', 'En ce moment,', 'un chat.'],
  ]),
  irregularFact('avoir', ['vous'], 'avez', ['av', 'ez'], [
    ['vous', 'Aujourd’hui,', 'raison.'],
    ['vous', 'En ce moment,', 'de la visite.'],
  ]),
  irregularFact('avoir', ['ils'], 'ont', ['o', 'nt'], [
    ['ils', 'Aujourd’hui,', 'un contrôle.'],
    ['ils', 'En ce moment,', 'des devoirs.'],
  ]),
];

const PRESENT_ALLER: ConjFactDef[] = [
  irregularFact('aller', ['je'], 'vais', ['vais', ''], [
    ['je', 'Aujourd’hui,', 'à l’école.'],
    ['je', 'En ce moment,', 'très bien.'],
  ]),
  irregularFact('aller', ['tu'], 'vas', ['va', 's'], [
    ['tu', 'Aujourd’hui,', 'chez mamie.'],
    ['tu', 'En ce moment,', 'trop vite.'],
  ]),
  irregularFact('aller', ['il'], 'va', ['va', ''], [
    ['il', 'Aujourd’hui,', 'au cinéma.'],
    ['il', 'En ce moment,', 'mieux.'],
  ]),
  irregularFact('aller', ['nous'], 'allons', ['all', 'ons'], [
    ['nous', 'Aujourd’hui,', 'à la mer.'],
    ['nous', 'En ce moment,', 'au marché.'],
  ]),
  irregularFact('aller', ['vous'], 'allez', ['all', 'ez'], [
    ['vous', 'Aujourd’hui,', 'au stade.'],
    ['vous', 'En ce moment,', 'très loin.'],
  ]),
  irregularFact('aller', ['ils'], 'vont', ['vo', 'nt'], [
    ['ils', 'Aujourd’hui,', 'à la cantine.'],
    ['ils', 'En ce moment,', 'dans la forêt.'],
  ]),
];

const PRESENT_FAIRE: ConjFactDef[] = [
  irregularFact('faire', ['je', 'tu'], 'fais', ['fai', 's'], [
    ['je', 'Aujourd’hui,', 'un gâteau.'],
    ['tu', 'En ce moment,', 'tes devoirs.'],
  ]),
  irregularFact('faire', ['il'], 'fait', ['fait', ''], [
    ['il', 'Aujourd’hui,', 'beau.'],
    ['il', 'En ce moment,', 'du vélo.'],
  ]),
  irregularFact('faire', ['nous'], 'faisons', ['fais', 'ons'], [
    ['nous', 'Aujourd’hui,', 'un jeu.'],
    ['nous', 'En ce moment,', 'des crêpes.'],
  ]),
  // « faites » : l'exception à vous → -ez.
  irregularFact('faire', ['vous'], 'faites', ['faites', ''], [
    ['vous', 'Aujourd’hui,', 'du sport.'],
    ['vous', 'En ce moment,', 'trop de bruit.'],
  ]),
  irregularFact('faire', ['ils'], 'font', ['fo', 'nt'], [
    ['ils', 'Aujourd’hui,', 'la course.'],
    ['ils', 'En ce moment,', 'un dessin.'],
  ]),
];

const PRESENT_DIRE: ConjFactDef[] = [
  irregularFact('dire', ['je', 'tu'], 'dis', ['di', 's'], [
    ['je', 'Aujourd’hui,', 'la vérité.'],
    ['tu', 'En ce moment,', 'un secret.'],
  ]),
  irregularFact('dire', ['il'], 'dit', ['dit', ''], [
    ['il', 'Aujourd’hui,', 'bonjour.'],
    ['il', 'En ce moment,', 'un poème.'],
  ]),
  irregularFact('dire', ['nous'], 'disons', ['dis', 'ons'], [
    ['nous', 'Aujourd’hui,', 'merci.'],
    ['nous', 'En ce moment,', 'la vérité.'],
  ]),
  // « dites » : l'exception à vous → -ez.
  irregularFact('dire', ['vous'], 'dites', ['dites', ''], [
    ['vous', 'Aujourd’hui,', 'au revoir.'],
    ['vous', 'En ce moment,', 'la même chose.'],
  ]),
  irregularFact('dire', ['ils'], 'disent', ['dis', 'ent'], [
    ['ils', 'Aujourd’hui,', 'oui.'],
    ['ils', 'En ce moment,', 'une comptine.'],
  ]),
];

const PRESENT_VENIR: ConjFactDef[] = [
  irregularFact('venir', ['je', 'tu'], 'viens', ['vien', 's'], [
    ['je', 'Aujourd’hui,', 'avec toi.'],
    ['tu', 'En ce moment,', 'de la piscine.'],
  ]),
  irregularFact('venir', ['il'], 'vient', ['vient', ''], [
    ['il', 'Aujourd’hui,', 'à la maison.'],
    ['il', 'En ce moment,', 'du jardin.'],
  ]),
  irregularFact('venir', ['nous'], 'venons', ['ven', 'ons'], [
    ['nous', 'Aujourd’hui,', 'en bus.'],
    ['nous', 'En ce moment,', 'de l’école.'],
  ]),
  irregularFact('venir', ['vous'], 'venez', ['ven', 'ez'], [
    ['vous', 'Aujourd’hui,', 'avec nous.'],
    ['vous', 'En ce moment,', 'de loin.'],
  ]),
  irregularFact('venir', ['ils'], 'viennent', ['vienn', 'ent'], [
    ['ils', 'Aujourd’hui,', 'à midi.'],
    ['ils', 'En ce moment,', 'du stade.'],
  ]),
];

const PRESENT_VOIR: ConjFactDef[] = [
  irregularFact('voir', ['je', 'tu'], 'vois', ['voi', 's'], [
    ['je', 'Aujourd’hui,', 'la mer.'],
    ['tu', 'En ce moment,', 'le tableau.'],
  ]),
  irregularFact('voir', ['il'], 'voit', ['voit', ''], [
    ['il', 'Aujourd’hui,', 'ses copains.'],
    ['il', 'En ce moment,', 'un oiseau.'],
  ]),
  irregularFact('voir', ['nous'], 'voyons', ['voy', 'ons'], [
    ['nous', 'Aujourd’hui,', 'un film.'],
    ['nous', 'En ce moment,', 'la montagne.'],
  ]),
  irregularFact('voir', ['vous'], 'voyez', ['voy', 'ez'], [
    ['vous', 'Aujourd’hui,', 'la lune.'],
    ['vous', 'En ce moment,', 'le bateau.'],
  ]),
  irregularFact('voir', ['ils'], 'voient', ['voi', 'ent'], [
    ['ils', 'Aujourd’hui,', 'le spectacle.'],
    ['ils', 'En ce moment,', 'des étoiles.'],
  ]),
];

// --- Bloc 3 — imparfait : 6 terminaisons + 1 radical ------------------------

const IMPARFAIT: ConjFactDef[] = [
  endingFact('imparfait', 'je', [
    ['chanter', 'Hier,', 'sous la douche.'],
    ['aimer', 'Avant,', 'les épinards.'],
    ['jouer', 'L’an dernier,', 'au foot.'],
  ]),
  endingFact('imparfait', 'tu', [
    ['regarder', 'Hier,', 'un dessin animé.'],
    ['parler', 'Avant,', 'moins fort.'],
    ['donner', 'L’an dernier,', 'des bonbons.'],
  ]),
  endingFact('imparfait', 'il', [
    ['trouver', 'Hier,', 'toujours des excuses.'],
    ['chanter', 'Avant,', 'dans une chorale.'],
    ['jouer', 'L’an dernier,', 'du piano.'],
  ]),
  endingFact('imparfait', 'nous', [
    // « nous mangions » : le e de mangeons DISPARAÎT devant le i (§3.2).
    ['manger', 'Hier,', 'à la cantine.'],
    ['regarder', 'Avant,', 'la télé le soir.'],
    ['jouer', 'L’an dernier,', 'ensemble.'],
  ]),
  endingFact('imparfait', 'vous', [
    ['parler', 'Hier,', 'de vos vacances.'],
    ['aimer', 'Avant,', 'ce jeu.'],
    ['chanter', 'L’an dernier,', 'en anglais.'],
  ]),
  endingFact('imparfait', 'ils', [
    ['donner', 'Hier,', 'la main.'],
    ['trouver', 'Avant,', 'ça facile.'],
    // « ils mangeaient » : le e revient devant le a.
    ['manger', 'L’an dernier,', 'à midi.'],
  ]),
  // Le SEUL verbe français dont l'imparfait ne se fabrique pas sur « nous ».
  stemFact('imparfait', 'être', 'ét', [
    ['je', 'Hier,', 'malade.'],
    ['nous', 'Avant,', 'voisins.'],
    ['ils', 'L’an dernier,', 'dans ma classe.'],
  ]),
];

// --- Bloc 4 — futur : 6 terminaisons + 6 radicaux ---------------------------

const FUTUR: ConjFactDef[] = [
  endingFact('futur', 'je', [
    ['chanter', 'Demain,', 'à la fête.'],
    ['jouer', 'Bientôt,', 'avec toi.'],
    ['donner', 'La semaine prochaine,', 'mon dessin.'],
  ]),
  endingFact('futur', 'tu', [
    ['regarder', 'Demain,', 'le match.'],
    ['parler', 'Bientôt,', 'anglais.'],
    ['donner', 'La semaine prochaine,', 'ton cadeau.'],
  ]),
  endingFact('futur', 'il', [
    ['trouver', 'Demain,', 'la réponse.'],
    ['chanter', 'Bientôt,', 'sur scène.'],
    ['jouer', 'La semaine prochaine,', 'au tennis.'],
  ]),
  endingFact('futur', 'nous', [
    // « nous mangerons » : pas de e ajouté, le radical du futur est l'infinitif.
    ['manger', 'Demain,', 'au restaurant.'],
    ['regarder', 'Bientôt,', 'les étoiles.'],
    ['chanter', 'La semaine prochaine,', 'ensemble.'],
  ]),
  endingFact('futur', 'vous', [
    ['parler', 'Demain,', 'au directeur.'],
    ['aimer', 'Bientôt,', 'la piscine.'],
    ['trouver', 'La semaine prochaine,', 'le trésor.'],
  ]),
  endingFact('futur', 'ils', [
    ['jouer', 'Demain,', 'dehors.'],
    ['donner', 'Bientôt,', 'leur réponse.'],
    ['chanter', 'La semaine prochaine,', 'à l’école.'],
  ]),
  stemFact('futur', 'être', 'ser', [
    ['je', 'Demain,', 'en vacances.'],
    ['nous', 'Bientôt,', 'prêts.'],
    ['ils', 'La semaine prochaine,', 'à la maison.'],
  ]),
  stemFact('futur', 'avoir', 'aur', [
    ['je', 'Demain,', 'dix ans.'],
    ['tu', 'Bientôt,', 'une surprise.'],
    ['ils', 'La semaine prochaine,', 'des vacances.'],
  ]),
  stemFact('futur', 'aller', 'ir', [
    ['je', 'Demain,', 'à la piscine.'],
    ['nous', 'Bientôt,', 'au cinéma.'],
    ['vous', 'La semaine prochaine,', 'à Paris.'],
  ]),
  stemFact('futur', 'faire', 'fer', [
    ['je', 'Demain,', 'un gâteau.'],
    ['nous', 'Bientôt,', 'du vélo.'],
    ['ils', 'La semaine prochaine,', 'la course.'],
  ]),
  stemFact('futur', 'venir', 'viendr', [
    ['je', 'Demain,', 'avec toi.'],
    ['tu', 'Bientôt,', 'chez moi.'],
    ['ils', 'La semaine prochaine,', 'à midi.'],
  ]),
  stemFact('futur', 'voir', 'verr', [
    ['je', 'Demain,', 'la mer.'],
    ['nous', 'Bientôt,', 'le spectacle.'],
    ['vous', 'La semaine prochaine,', 'la neige.'],
  ]),
];

// Note : `dire` n'a PAS de radical irrégulier au futur — « je dirai » se
// fabrique par la règle (infinitif moins le e des verbes en -re, §3.2). C'est
// pourquoi le bloc futur compte 6 radicaux pour 7 verbes irréguliers.

/** L'inventaire complet : 63 faits (spec §3.3). */
export const CONJ_FACT_DEFS: readonly ConjFactDef[] = [
  ...PRESENT_G1,
  ...PRESENT_ETRE,
  ...PRESENT_AVOIR,
  ...PRESENT_ALLER,
  ...PRESENT_FAIRE,
  ...PRESENT_DIRE,
  ...PRESENT_VENIR,
  ...PRESENT_VOIR,
  ...IMPARFAIT,
  ...FUTUR,
];

const DEFS_BY_KEY = new Map(CONJ_FACT_DEFS.map((d) => [d.key, d]));

export function conjFactDef(key: string): ConjFactDef | undefined {
  return DEFS_BY_KEY.get(key);
}

/** Variante stricte, pour les appelants qui savent la clé valide (tests, UI). */
export function requireConjFactDef(key: string): ConjFactDef {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new Error(`Fait de conjugaison inconnu : ${key}`);
  return def;
}

/** Les 63 faits, en boîte 1, non introduits. */
export function createInitialConjFacts(): ConjFact[] {
  return CONJ_FACT_DEFS.map((def) => ({
    key: def.key,
    box: 1 as const,
    lastSeen: '',
    nextDue: '',
    history: [],
    introduced: false,
  }));
}

/** Faits d'un temps donné (badges « temps », déblocages, image mystère). */
export function conjFactsOfTense<T extends { key: string }>(facts: T[], tense: ConjTense): T[] {
  return facts.filter((f) => conjFactDef(f.key)?.tense === tense);
}

/** Faits portés par un verbe irrégulier (badges « par verbe », 7 badges). */
export function conjFactsOfVerb<T extends { key: string }>(facts: T[], verb: string): T[] {
  return facts.filter((f) => conjFactDef(f.key)?.verb === verb);
}

// --- Dérivation d'une question ---------------------------------------------

/**
 * Radical régulier d'un verbe pour un temps donné (spec §3.2) :
 * - présent / imparfait : le radical de « nous » — pour le 1er groupe,
 *   l'infinitif moins -er (nous chant|ons → je chant|ais) ;
 * - futur : l'infinitif entier, moins le e final des verbes en -re
 *   (chanter → chanterai, dire → dirai).
 */
export function regularStem(verb: string, tense: ConjTense): string {
  if (tense === 'futur') return verb.endsWith('e') ? verb.slice(0, -1) : verb;
  return verb.slice(0, -2);
}

/**
 * Pièges de son (spec §3.2) : le g et le c doivent garder leur son doux devant
 * a, o, u. « mang- + ons → man|geons », « lanc- + ons → lan|çons ».
 *
 * La lettre modifiée BASCULE dans la terminaison à taper — c'est la
 * segmentation de la spec (« nous man|geons ») : le radical affiché est celui
 * qui ne bouge pas, et l'enfant tape ce qui change. Rendre l'enfant
 * responsable du « ge » est précisément l'objet du piège.
 */
export function applyEuphony(stem: string, ending: string): [string, string] {
  if (!/^[aou]/.test(ending)) return [stem, ending];
  if (stem.endsWith('g')) return [stem.slice(0, -1), `ge${ending}`];
  if (stem.endsWith('c')) return [stem.slice(0, -1), `ç${ending}`];
  return [stem, ending];
}

/** Pronom sujet, avec élision devant voyelle : « j’ai », « je chante ». */
export function conjSubject(person: ConjPerson, form: string): string {
  if (person !== 'je') return `${person} `;
  return /^[aeiouâàäéèêëîïôöûùüyh]/i.test(form) ? 'j’' : 'je ';
}

/** Tout ce qu'il faut pour poser, corriger et lire une question. */
export interface ConjQuestionView {
  def: ConjFactDef;
  carrier: ConjCarrier;
  verb: string;
  person: ConjPerson;
  /** Radical affiché à gauche du blanc ('' quand la forme entière est tapée). */
  displayedStem: string;
  /** Ce que l'enfant doit taper (terminaison seule, ou forme entière). */
  expected: string;
  /** Forme verbale complète, correctement orthographiée. */
  form: string;
  /** Segmentation radical|terminaison de la forme complète (§2.3, §4.5). */
  segment: [string, string];
  /** Vrai si seule la terminaison est à taper (radical affiché) — §4.2. */
  endingOnly: boolean;
  /** Début de phrase, pronom compris : « Demain, nous ». */
  lead: string;
  /** Fin de phrase : « des crêpes. » (chaîne vide si la phrase s'arrête là). */
  tail: string;
  /** Phrase complète, forme incluse — énoncé TTS et rappel de correction. */
  sentence: string;
  /** Clé stable du MP3 de la phrase porteuse. */
  ttsKey: string;
}

/**
 * Dérive la question du couple (fait, phrase porteuse) : réponse attendue,
 * radical affiché, segmentation, phrase lue.
 */
export function resolveConjQuestion(def: ConjFactDef, carrierIndex: number): ConjQuestionView {
  const index = ((carrierIndex % def.carriers.length) + def.carriers.length) % def.carriers.length;
  const carrier = def.carriers[index];
  const { person, verb } = carrier;

  let displayedStem: string;
  let expected: string;
  let segment: [string, string];
  let endingOnly: boolean;

  if (def.kind === 'ending') {
    const [stem, ending] = applyEuphony(regularStem(verb, def.tense), def.ending as string);
    displayedStem = stem;
    expected = ending;
    segment = [stem, ending];
    endingOnly = true;
  } else if (def.kind === 'stem') {
    const ending = conjEndings(def.tense)[person];
    const stem = def.stem as string;
    displayedStem = '';
    expected = stem + ending;
    segment = [stem, ending];
    endingOnly = false;
  } else {
    const [stem, mark] = def.segment as readonly [string, string];
    displayedStem = '';
    expected = def.form as string;
    segment = [stem, mark];
    endingOnly = false;
  }

  const form = segment[0] + segment[1];
  const lead = `${carrier.before} ${conjSubject(person, form)}`;
  const tail = carrier.after ? ` ${carrier.after}` : '';

  return {
    def,
    carrier,
    verb,
    person,
    displayedStem,
    expected,
    form,
    segment,
    endingOnly,
    lead,
    tail,
    sentence: `${lead}${form}${tail}`,
    ttsKey: conjTtsKey(def.key, index),
  };
}

/**
 * Clé du MP3 d'une phrase porteuse. Stable : elle ne dépend que de la clé du
 * fait et du rang de la porteuse — à ajouter dans scripts/generate-tts.mjs.
 */
export function conjTtsKey(factKey: string, carrierIndex: number): string {
  return `conj-${factKey}-${carrierIndex}`;
}

/** Toutes les phrases porteuses de l'inventaire, pour la génération TTS. */
export function allConjCarrierSentences(): { key: string; text: string }[] {
  return CONJ_FACT_DEFS.flatMap((def) =>
    def.carriers.map((_, i) => {
      const view = resolveConjQuestion(def, i);
      return { key: view.ttsKey, text: view.sentence };
    }),
  );
}

// --- Comparaison phonétique (spec §4.5, cas « presque ») --------------------

/**
 * Clé phonétique APPROXIMATIVE d'un radical. Sert uniquement à décider si une
 * coquille dans le radical est « phonétiquement plausible » — auquel cas la
 * réponse est acceptée pour le Leitner : on ne pénalise jamais l'orthographe
 * lexicale dans un jeu de conjugaison.
 *
 * ⚠️ À n'appliquer QU'AU RADICAL, jamais à la terminaison : en français les
 * terminaisons verbales sont massivement homophones (chante / chantes /
 * chantent), et c'est exactement la discrimination que le jeu teste. Une clé
 * phonétique appliquée à la forme entière accepterait « ils chante ».
 *
 * Les accents sont neutralisés (« etes » pour « êtes » passe) : c'est un choix
 * assumé, cohérent avec « jamais de pénalité sur l'orthographe lexicale ».
 */
export function phoneticKey(stem: string): string {
  let s = stripAccents(stem.toLowerCase()).replace(/[’'-]/g, '');
  s = s.replace(/ph/g, 'f');
  s = s.replace(/qu/g, 'k');
  s = s.replace(/ch/g, 'C');
  s = s.replace(/c([eiy])/g, 's$1');
  s = s.replace(/ç/g, 's');
  s = s.replace(/c/g, 'k');
  s = s.replace(/g([eiy])/g, 'j$1');
  s = s.replace(/y/g, 'i');
  s = s.replace(/([aeiou])s([aeiou])/g, '$1z$2');
  s = s.replace(/oi/g, 'wa');
  s = s.replace(/(au|eau)/g, 'o');
  s = s.replace(/(ai|ei)/g, 'e');
  s = s.replace(/h/g, '');
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}

/** Deux radicaux sont-ils la même chose à l'oreille ? (« cer- » ≡ « ser- ») */
export function isPhoneticallyClose(a: string, b: string): boolean {
  return phoneticKey(a) === phoneticKey(b);
}

/** Normalisation d'une saisie avant comparaison (casse, espaces, apostrophes). */
export function normalizeConjAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");
}

import type { IrrFact } from '../types';

// === Matière verbes irréguliers anglais — l'inventaire (specs §16.3) ===
//
// 64 verbes, exactement une grille 8×8 pour l'image mystère : chaque case est
// un verbe. Un fait = un VERBE : la question donne l'infinitif, l'enfant
// produit le prétérit et le participe passé (« go » → « went, gone »), comme
// la récitation de la classe.
//
// AUCUN import runtime ici (seulement des types, effacés à la transformation) :
// `scripts/generate-tts.mjs` charge ce module fichier par fichier pour générer
// les MP3, et un import relatif ne s'y résout pas (cf. i18n/conjugation.ts).

/**
 * Familles de formes (specs §16.3). Elles servent d'ASTUCE par analogie
 * (« comme sing → sang → sung »), jamais de règle : aucune ne permet de
 * fabriquer une forme. Elles organisent aussi l'entrelacement (jamais deux
 * questions consécutives de la même famille) et les badges.
 */
export type IrrFamily =
  | 'same' // trois fois la même forme : put, put, put
  | 'ought' // passé en -ought / -aught
  | 'iau' // i → a → u : sing, sang, sung
  | 'ew' // -ew / -own : know, knew, known
  | 'back' // le participe revient à l'infinitif : come, came, come
  | 'en' // participe en -en / -n : take, took, taken
  | 't' // deux formes pareilles en -t : sleep, slept, slept
  | 'd' // deux formes pareilles en -d : tell, told, told
  | 'vowel' // deux formes pareilles, la voyelle change : sit, sat, sat
  | 'unique'; // sans famille : be, do, go, wear

/** Ordre d'affichage des familles (règles, badges). */
export const IRR_FAMILIES: readonly IrrFamily[] = [
  'same',
  'ought',
  'iau',
  'ew',
  'back',
  'en',
  't',
  'd',
  'vowel',
  'unique',
];

export interface IrrVerbDef {
  /** L'infinitif, clé stable du fait. */
  key: string;
  /**
   * Prétérit(s) attendu(s), TOUS requis, dans n'importe quel ordre. Un seul
   * sauf pour « be », qui attend « was » ET « were » (specs §16.3).
   */
  preterite: readonly string[];
  /**
   * Participe passé : formes ACCEPTÉES, la première est celle qu'on affiche.
   * « get » accepte « got » (britannique) comme « gotten » (américain).
   */
  participle: readonly string[];
  /** Traduction française, montrée à l'introduction et à la correction. */
  fr: string;
  family: IrrFamily;
}

function v(
  key: string,
  preterite: string | string[],
  participle: string | string[],
  fr: string,
  family: IrrFamily,
): IrrVerbDef {
  return {
    key,
    preterite: Array.isArray(preterite) ? preterite : [preterite],
    participle: Array.isArray(participle) ? participle : [participle],
    fr,
    family,
  };
}

/**
 * L'inventaire, dans l'ORDRE D'INTRODUCTION par défaut : la fréquence (specs
 * §16.3). Les verbes « vus en classe », cochés par le parent, passent devant
 * (cf. irrIntroPriority) : chaque classe suit sa propre liste. C'est aussi
 * l'ordre des cases de l'image mystère.
 */
const IRR_VERBS: readonly IrrVerbDef[] = [
  v('be', ['was', 'were'], 'been', 'être', 'unique'),
  v('have', 'had', 'had', 'avoir', 'd'),
  v('do', 'did', 'done', 'faire', 'unique'),
  v('go', 'went', 'gone', 'aller', 'unique'),
  v('say', 'said', 'said', 'dire', 'd'),
  v('get', 'got', ['got', 'gotten'], 'obtenir', 'vowel'),
  v('make', 'made', 'made', 'fabriquer', 'd'),
  v('know', 'knew', 'known', 'savoir', 'ew'),
  v('think', 'thought', 'thought', 'penser', 'ought'),
  v('take', 'took', 'taken', 'prendre', 'en'),
  v('see', 'saw', 'seen', 'voir', 'en'),
  v('come', 'came', 'come', 'venir', 'back'),
  v('give', 'gave', 'given', 'donner', 'en'),
  v('find', 'found', 'found', 'trouver', 'd'),
  v('tell', 'told', 'told', 'raconter', 'd'),
  v('feel', 'felt', 'felt', 'ressentir', 't'),
  v('leave', 'left', 'left', 'partir', 't'),
  v('put', 'put', 'put', 'mettre', 'same'),
  v('bring', 'brought', 'brought', 'apporter', 'ought'),
  v('begin', 'began', 'begun', 'commencer', 'iau'),
  v('keep', 'kept', 'kept', 'garder', 't'),
  v('hold', 'held', 'held', 'tenir', 'd'),
  v('write', 'wrote', 'written', 'écrire', 'en'),
  v('stand', 'stood', 'stood', 'être debout', 'd'),
  v('hear', 'heard', 'heard', 'entendre', 'd'),
  v('let', 'let', 'let', 'laisser', 'same'),
  v('meet', 'met', 'met', 'rencontrer', 'vowel'),
  v('run', 'ran', 'run', 'courir', 'back'),
  v('sit', 'sat', 'sat', "s'asseoir", 'vowel'),
  v('speak', 'spoke', 'spoken', 'parler', 'en'),
  v('read', 'read', 'read', 'lire', 'same'),
  v('grow', 'grew', 'grown', 'grandir', 'ew'),
  v('lose', 'lost', 'lost', 'perdre', 't'),
  v('fall', 'fell', 'fallen', 'tomber', 'en'),
  v('send', 'sent', 'sent', 'envoyer', 't'),
  v('build', 'built', 'built', 'construire', 't'),
  v('draw', 'drew', 'drawn', 'dessiner', 'ew'),
  v('break', 'broke', 'broken', 'casser', 'en'),
  v('spend', 'spent', 'spent', 'dépenser', 't'),
  v('cut', 'cut', 'cut', 'couper', 'same'),
  v('drive', 'drove', 'driven', 'conduire', 'en'),
  v('buy', 'bought', 'bought', 'acheter', 'ought'),
  v('wear', 'wore', 'worn', 'porter (un vêtement)', 'unique'),
  v('choose', 'chose', 'chosen', 'choisir', 'en'),
  v('eat', 'ate', 'eaten', 'manger', 'en'),
  v('drink', 'drank', 'drunk', 'boire', 'iau'),
  v('sing', 'sang', 'sung', 'chanter', 'iau'),
  v('swim', 'swam', 'swum', 'nager', 'iau'),
  v('sleep', 'slept', 'slept', 'dormir', 't'),
  v('fly', 'flew', 'flown', 'voler (dans les airs)', 'ew'),
  v('throw', 'threw', 'thrown', 'lancer', 'ew'),
  v('ride', 'rode', 'ridden', 'monter (à vélo, à cheval)', 'en'),
  v('teach', 'taught', 'taught', 'enseigner', 'ought'),
  v('catch', 'caught', 'caught', 'attraper', 'ought'),
  v('win', 'won', 'won', 'gagner', 'vowel'),
  v('forget', 'forgot', 'forgotten', 'oublier', 'en'),
  v('hide', 'hid', 'hidden', 'cacher', 'en'),
  v('ring', 'rang', 'rung', 'sonner', 'iau'),
  v('hit', 'hit', 'hit', 'frapper', 'same'),
  v('hurt', 'hurt', 'hurt', 'faire mal', 'same'),
  v('sell', 'sold', 'sold', 'vendre', 'd'),
  v('blow', 'blew', 'blown', 'souffler', 'ew'),
  v('wake', 'woke', 'woken', 'se réveiller', 'en'),
  v('fight', 'fought', 'fought', 'se battre', 'ought'),
];

const BY_KEY = new Map(IRR_VERBS.map((def) => [def.key, def]));
const RANK = new Map(IRR_VERBS.map((def, i) => [def.key, i]));
// Verbes de chaque famille, dans l'ordre de l'inventaire : l'inventaire est
// figé, les badges et l'analogie de famille les relisent souvent.
const BY_FAMILY = new Map<IrrFamily, IrrVerbDef[]>(
  IRR_FAMILIES.map((family) => [family, IRR_VERBS.filter((def) => def.family === family)]),
);

export function irrVerbDefs(): readonly IrrVerbDef[] {
  return IRR_VERBS;
}

export function irrVerbDef(key: string): IrrVerbDef | undefined {
  return BY_KEY.get(key);
}

export function requireIrrVerbDef(key: string): IrrVerbDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Verbe irrégulier inconnu : ${key}`);
  return def;
}

/** Rang d'introduction (fréquence), -1 pour une clé inconnue. */
export function irrIntroRank(key: string): number {
  return RANK.get(key) ?? -1;
}

/**
 * Priorité d'introduction d'un verbe (plus petit = plus tôt, specs §16.3) :
 * les verbes vus en classe d'abord, dans l'ordre où le parent les a cochés,
 * puis tous les autres par fréquence.
 */
export function irrIntroPriority(key: string, classVerbs: readonly string[] = []): number {
  const i = classVerbs.indexOf(key);
  return i >= 0 ? i : classVerbs.length + irrIntroRank(key);
}

/**
 * Les verbes de l'inventaire, du premier introduit au dernier (cf.
 * irrIntroPriority).
 */
export function irrVerbsInIntroOrder(classVerbs: readonly string[] = []): IrrVerbDef[] {
  return [...IRR_VERBS].sort(
    (a, b) => irrIntroPriority(a.key, classVerbs) - irrIntroPriority(b.key, classVerbs),
  );
}

/**
 * La liste « vus en classe » d'un profil, assainie : des clés de l'inventaire,
 * sans doublon, dans leur ordre. Le JSON d'un profil s'édite à la main
 * (export/import) : tout le reste est ignoré.
 */
export function sanitizeIrrClassVerbs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const key of value) {
    if (typeof key === 'string' && BY_KEY.has(key)) seen.add(key);
  }
  return [...seen];
}

/** Index dans l'inventaire de la case (row, col) de la grille 8×8. */
export function irrGridIndex(row: number, col: number): number {
  return row * 8 + col;
}

/** Les 64 verbes, en boîte 1, non introduits (cf. createInitialConjFacts). */
export function createInitialIrrFacts(): IrrFact[] {
  return IRR_VERBS.map((def) => ({
    key: def.key,
    box: 1 as const,
    lastSeen: '',
    nextDue: '',
    history: [],
    introduced: false,
  }));
}

/** Verbes d'une famille, dans l'ordre de l'inventaire. */
export function irrVerbsOfFamily(family: IrrFamily): readonly IrrVerbDef[] {
  return BY_FAMILY.get(family) ?? [];
}

// --- Formes attendues et affichage ------------------------------------------

/**
 * Nombre de cases à remplir : les prétérits (deux pour « be ») puis le
 * participe. C'est ce que demande le clavier, case par case, et ce que la voix
 * doit avoir entendu avant de juger.
 */
export function irrSlotCount(def: IrrVerbDef): number {
  return def.preterite.length + 1;
}

/** Les formes attendues dans l'ordre des cases (participe canonique). */
export function irrExpectedForms(def: IrrVerbDef): string[] {
  return [...def.preterite, def.participle[0]];
}

/** Récitation complète, telle qu'affichée : « go – went – gone ». */
export function irrRecitation(def: IrrVerbDef): string {
  return [def.key, def.preterite.join('/'), def.participle.join('/')].join(' – ');
}

/** Lettres à produire (sans espaces) — l'unité du seuil de rapidité clavier. */
export function irrExpectedLetters(def: IrrVerbDef): number {
  return irrExpectedForms(def).join('').length;
}

/**
 * Réponse normalisée : minuscules, lettres seules. L'apostrophe tombe aussi,
 * ce qui ramène « we're » (transcription courante de « were ») à « were ».
 */
export function normalizeIrrWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

// --- Audio (specs §16.5) -----------------------------------------------------
//
// Deux MP3 par verbe, générés avec la voix ANGLAISE et lus en anglais quelle
// que soit la langue de l'interface (cf. hooks/useTTS, préfixe `irr-`).

/** Énoncé de la question : l'infinitif seul (« go »). */
export function irrPromptTtsKey(key: string): string {
  return `irr-${key}`;
}

/** Récitation complète (« go, went, gone ») : introduction et correction. */
export function irrRecitationTtsKey(key: string): string {
  return `irr-${key}-all`;
}

/** Préfixe des clés TTS de la matière, lues en anglais par `useTTS`. */
export const IRR_TTS_PREFIX = 'irr-';

// Ce que la synthèse LIT quand l'orthographe ne dit pas le son : « read » se
// dit /riːd/ à l'infinitif, /rɛd/ au passé. Écrit « read, read, read », rien ne
// lui permet de choisir, et la récitation s'entendait « red, red, red »
// (transcription du 12/10/2026). Toutes les formes, dans l'ordre de la
// récitation.
const SPOKEN: Record<string, readonly string[]> = {
  read: ['reed', 'red', 'red'],
};

/**
 * Textes à synthétiser, pour `scripts/generate-tts.mjs`. `forms` : ce que la
 * récitation doit faire entendre, dans l'ordre. Le script vérifie, sur une
 * transcription, que deux formes différentes ne sonnent pas pareil : la
 * synthèse remplace parfois l'infinitif par la forme suivante (« knew, knew,
 * known » pour know, avis parent du 11/10/2026).
 */
export function allIrrTtsEntries(): { key: string; text: string; forms?: string[] }[] {
  return IRR_VERBS.flatMap((def) => {
    const forms = [...(SPOKEN[def.key] ?? [def.key, ...irrExpectedForms(def)])];
    return [
      { key: irrPromptTtsKey(def.key), text: `${forms[0]}.` },
      { key: irrRecitationTtsKey(def.key), text: `${forms.join(', ')}.`, forms },
    ];
  });
}

// --- Homophones (specs §16.6) ------------------------------------------------
//
// La reconnaissance vocale renvoie des mots orthographiés, pas des sons :
// « ate » revient souvent « eight », « won » revient « one » ou « 1 ». Table
// énumérée à la main, par FORME (de l'inventaire) : une transcription n'est
// ramenée à une forme que si cette forme fait partie du verbe interrogé —
// « one » n'est lu « won » que pour « win ».

const HOMOPHONES: Record<string, readonly string[]> = {
  // Infinitifs (récités en tête de la réponse, puis retirés).
  be: ['bee', 'b'],
  know: ['no'],
  buy: ['by', 'bye'],
  see: ['sea', 'c'],
  write: ['right', 'rite'],
  hear: ['here'],
  meet: ['meat'],
  read: ['reed', 'red'],
  wear: ['where', 'ware'],
  sell: ['cell'],
  break: ['brake'],
  choose: ['chews'],
  find: ['fined'],
  // Formes passées.
  were: ['where'],
  been: ['bean', 'bin', 'ben'],
  done: ['dun'],
  made: ['maid'],
  knew: ['new', 'gnu'],
  saw: ['sore', 'soar'],
  told: ['tolled'],
  sold: ['soled'],
  heard: ['herd'],
  sat: ['sad'],
  sent: ['cent', 'scent'],
  wrote: ['rote'],
  ate: ['eight', '8'],
  won: ['one', '1'],
  threw: ['through', 'thru'],
  blew: ['blue'],
  flew: ['flu', 'flue'],
  rode: ['road', 'rowed'],
  rung: ['wrung'],
  seen: ['scene'],
  grown: ['groan'],
  thrown: ['throne'],
  wore: ['war'],
  worn: ['warn'],
  caught: ['court', 'cot', 'cort'],
  taught: ['taut', 'tort'],
  fought: ['fort'],
  put: ['putt'],
};

/**
 * Ramène un mot transcrit à une forme du verbe interrogé quand c'en est un
 * homophone connu ; le renvoie tel quel sinon.
 */
export function canonicalizeIrrWord(word: string, def: IrrVerbDef): string {
  // Chiffres gardés le temps de la recherche : « 8 » est un homophone de « ate ».
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  const forms = [def.key, ...def.preterite, ...def.participle];
  if (forms.includes(w)) return w;
  return forms.find((form) => HOMOPHONES[form]?.includes(w)) ?? w.replace(/\d/g, '');
}

/** Toutes les formes de l'inventaire (infinitifs compris). */
export function allIrrForms(): Set<string> {
  const forms = new Set<string>();
  for (const def of IRR_VERBS) {
    forms.add(def.key);
    for (const f of def.preterite) forms.add(f);
    for (const f of def.participle) forms.add(f);
  }
  return forms;
}

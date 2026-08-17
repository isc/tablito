import { isPhoneticallyClose, normalizeConjAnswer } from './conjugationFacts';
import {
  LETTER_NAMES,
  MAX_NAME_WORDS,
  SPELLING_FILLERS,
  type LetterNameDef,
} from './letterNames';
import { phonemesOf, sameSound, type PhoneticDict } from './phoneticDict';

// === Lire une épellation dans un transcript (spec §15.10) ===
//
// L'enfant dit la forme puis épelle : « chantent : e, n, t ». Le transcript
// arrive en orthographe (« chante haine T »), la cible est une suite de
// lettres. Tout le travail consiste à traverser le transcript mot à mot en
// décidant, pour chacun : nom de lettre ? forme dite avant l'épellation ?
// remplissage ? incompris ?
//
// Quatre étages, du plus sûr au plus tolérant :
//   1. nom composé ou remplissage sur plusieurs mots (« i grec », « c'est
//      tout ») — testés d'abord, sinon « i grec » donnerait i + un mot perdu ;
//   2. la lettre seule, telle que le STT l'écrit parfois (« N », « T ») ;
//   3. le nom de la lettre dans la table maison (« esse », « haine ») ;
//   4. l'appariement PHONÉMIQUE : on projette le mot transcrit sur ses
//      phonèmes et on compare aux prononciations des noms de lettres. C'est
//      l'étage qui rend inoffensive toute transcription homophone non
//      anticipée — on ne compare jamais en orthographe.
//
// Deux règles de confiance, qui décident si la reconstruction est soumise au
// jugement ou si l'on redemande gentiment (§15.10 : un raté de reconnaissance
// n'est JAMAIS une erreur Leitner) :
//
//   - **le préambule est libre** : tout ce qui précède la première lettre
//     reconnue est ignoré sans conséquence (la forme dite, un pronom, une
//     hésitation, un bout de phrase répété) ;
//   - **la fin ne l'est pas** : un mot incompris APRÈS la première lettre
//     signifie qu'on a probablement perdu une lettre en route. On préfère
//     redemander que soumettre une réponse trouée, qui serait comptée comme une
//     erreur de conjugaison alors que c'est le micro qui a fauté.

export type SpelledStatus =
  /** Épellation exploitable : à soumettre au jugement, comme une saisie clavier. */
  | 'letters'
  /** La forme a été dite, l'épellation n'est pas venue : on invite à épeler. */
  | 'form-only'
  /** Rien d'exploitable : re-demande neutre, jamais une erreur Leitner. */
  | 'unheard';

export interface SpelledParse {
  status: SpelledStatus;
  /** Lettres reconnues, dans l'ordre. */
  letters: string[];
  /** Les lettres recollées : la réponse à juger, exactement comme au clavier. */
  answer: string;
  /** La forme attendue a été reconnue à l'oral (appariement tolérant). */
  saidForm: boolean;
}

export interface SpelledParseOptions {
  /**
   * Forme verbale complète attendue (« chantent »), telle que l'enfant est
   * censé la prononcer avant d'épeler. Sert à la RECONNAÎTRE pour l'écarter du
   * décompte des lettres — pas à valider quoi que ce soit : l'homophonie
   * chante / chantes / chantent est ici une qualité, c'est l'épellation qui
   * porte la discrimination orthographique (§15.5).
   */
  expectedForm: string;
  /** Dictionnaire de prononciation ; absent, les étages 1-3 suffisent. */
  dict?: PhoneticDict | null;
  /**
   * Ne pas consommer la forme dite. Utilisé au second essai après une invite
   * « épelle » : quand la forme attendue EST une lettre (« il a » → « a »),
   * l'enfant qui épelle « a » dit exactement la forme, et l'écarter en
   * boucle ne mènerait nulle part.
   */
  ignoreForm?: boolean;
}

// --- Index dérivés de la table maison (une fois, au chargement du module) ---

const LETTERS = new Set(LETTER_NAMES.map((d) => d.letter));

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").trim();
}

const BY_NAME = new Map<string, string>();
const BY_PHONEME = new Map<string, string>();
const MULTI_NAMES: { words: string[]; letter: string }[] = [];

function indexLetter(def: LetterNameDef): void {
  for (const name of def.names) {
    const norm = normalizeWord(name);
    const words = norm.split(' ');
    if (words.length > 1) MULTI_NAMES.push({ words, letter: def.letter });
    else BY_NAME.set(norm, def.letter);
  }
  for (const phoneme of def.phonemes) BY_PHONEME.set(phoneme, def.letter);
}
LETTER_NAMES.forEach(indexLetter);

const FILLERS = new Set<string>();
const MULTI_FILLERS: string[][] = [];
for (const filler of SPELLING_FILLERS) {
  const words = normalizeWord(filler).split(' ');
  if (words.length > 1) MULTI_FILLERS.push(words);
  else FILLERS.add(words[0]);
}

// --- Découpage ---------------------------------------------------------------

interface Token {
  /** Tel que transcrit (la casse porte l'indice « lettres épelées » : « E N T »). */
  raw: string;
  /** Minuscule, apostrophe normalisée. */
  norm: string;
}

/**
 * Découpe sur tout ce qui n'est ni lettre ni apostrophe : « e.n.t », « e-n-t »
 * et « e, n, t » donnent tous trois mots, et « j'ai » reste entier.
 */
export function tokenizeTranscript(transcript: string): Token[] {
  return transcript
    .split(/[^\p{L}'’]+/u)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeWord(raw) }));
}

// --- Appariement ------------------------------------------------------------

/**
 * Suite de lettres épelées d'un trait par le STT (« ENT », « BCD ») : capitales
 * consécutives, toutes dans le périmètre. Renvoie null sinon — un mot en
 * capitales qui n'est pas une suite de lettres du périmètre reste un mot.
 */
function uppercaseRun(token: Token): string[] | null {
  if (token.raw.length < 2) return null;
  if (token.raw !== token.raw.toUpperCase()) return null;
  const letters = [...token.norm];
  return letters.every((l) => LETTERS.has(l)) ? letters : null;
}

/** La lettre nommée par ce mot, ou null. Étages 2, 3 et 4. */
export function letterFromWord(word: string, dict?: PhoneticDict | null): string | null {
  const norm = normalizeWord(word);
  if (norm.length === 1 && LETTERS.has(norm)) return norm;
  const named = BY_NAME.get(norm);
  if (named) return named;
  for (const phoneme of phonemesOf(dict ?? null, norm)) {
    const letter = BY_PHONEME.get(phoneme);
    if (letter) return letter;
  }
  return null;
}

/**
 * Ce mot est-il la forme attendue, dite à voix haute ? Appariement TOLÉRANT :
 * en phonèmes d'abord (le dictionnaire connaît toutes les formes de
 * l'inventaire), à défaut par la clé phonétique approximative de la matière
 * (`isPhoneticallyClose`, §15.5) ou par l'orthographe exacte.
 */
export function matchesSpokenForm(
  word: string,
  expectedForm: string,
  dict?: PhoneticDict | null,
): boolean {
  const norm = normalizeWord(word);
  if (!expectedForm) return false;
  if (normalizeConjAnswer(norm) === normalizeConjAnswer(expectedForm)) return true;
  if (sameSound(dict ?? null, norm, expectedForm)) return true;
  return isPhoneticallyClose(norm, expectedForm);
}

/** Un n-gramme du transcript apparie-t-il un nom composé ou un remplissage ? */
function matchPhrase(
  tokens: Token[],
  start: number,
  size: number,
): { letter: string | null } | null {
  const phrase = tokens
    .slice(start, start + size)
    .map((t) => t.norm)
    .join(' ');
  const named = MULTI_NAMES.find((m) => m.words.length === size && m.words.join(' ') === phrase);
  if (named) return { letter: named.letter };
  const filler = MULTI_FILLERS.find((f) => f.length === size && f.join(' ') === phrase);
  return filler ? { letter: null } : null;
}

/**
 * Lit une épellation dans un transcript. Fonction pure : c'est elle que les
 * tests couvrent, le composant vocal ne fait que l'appeler et afficher.
 */
export function parseSpelledLetters(
  transcript: string,
  { expectedForm, dict = null, ignoreForm = false }: SpelledParseOptions,
): SpelledParse {
  const tokens = tokenizeTranscript(transcript);
  const letters: string[] = [];
  let saidForm = false;
  let junkAfterLetters = false;

  let i = 0;
  while (i < tokens.length) {
    // 1. Noms composés et remplissages sur plusieurs mots, le plus long d'abord.
    let consumed = 0;
    for (let size = Math.min(MAX_NAME_WORDS, tokens.length - i); size >= 2; size--) {
      const phrase = matchPhrase(tokens, i, size);
      if (!phrase) continue;
      if (phrase.letter) letters.push(phrase.letter);
      consumed = size;
      break;
    }
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const token = tokens[i];
    i += 1;

    if (FILLERS.has(token.norm)) continue;

    // 2. La forme dite avant l'épellation — seulement tant qu'aucune lettre
    //    n'est arrivée : après, un mot qui sonne comme la forme est du bruit.
    if (!ignoreForm && letters.length === 0 && matchesSpokenForm(token.norm, expectedForm, dict)) {
      saidForm = true;
      continue;
    }

    // 3. Une suite de capitales épelée d'un trait.
    const run = uppercaseRun(token);
    if (run) {
      letters.push(...run);
      continue;
    }

    // 4. Lettre seule, nom connu, ou appariement phonémique.
    const letter = letterFromWord(token.norm, dict);
    if (letter) {
      letters.push(letter);
      continue;
    }

    // Incompris : anodin avant la première lettre, suspect après.
    if (letters.length > 0) junkAfterLetters = true;
  }

  const status: SpelledStatus =
    letters.length > 0 && !junkAfterLetters
      ? 'letters'
      : letters.length === 0 && saidForm
        ? 'form-only'
        : 'unheard';

  return { status, letters, answer: letters.join(''), saidForm };
}

import { isPhoneticallyClose, normalizeConjAnswer } from './conjugationFacts';
import { LETTER_NAMES, SPELLING_FILLERS, type LetterNameDef } from './letterNames';
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
//     hésitation, un bout de phrase répété). Attention : « ignoré » vaut pour
//     les mots INCOMPRIS — un mot du préambule qui est un nom de lettre écrit
//     bel et bien sa lettre. D'où les deux consommations explicites qui
//     encadrent la règle : la forme attendue (`expectedForm`) et le pronom de
//     la question (`subject`, car « elle » est le nom de la lettre l) ;
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
  /**
   * Pronom sujet de la QUESTION, tel qu'affiché (« nous », « elle », « j’ »).
   * Consommé comme préambule, avant toute recherche de lettre.
   *
   * Sans lui, un pronom qui est aussi un nom de lettre écrirait sa lettre :
   * « elle » EST le nom de la lettre l (cf. letterNames), donc « elle chante :
   * c, h, a, n, t, e » commencerait par un l parasite — et le « chante » qui
   * suit, arrivant après une première lettre, passerait pour du bruit de fin,
   * ce qui condamne tout le reste de l'épellation. La règle du préambule
   * (§15.10) ne suffit pas ici : elle ignore les mots INCOMPRIS avant la
   * première lettre, or un nom de lettre est justement compris.
   */
  subject?: string;
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

// Normalisation des mots (casse, apostrophes, espaces) : celle de la matière,
// `normalizeConjAnswer`, appliquée aussi bien à la table qu'aux transcripts —
// deux normalisateurs dans un même module finiraient par diverger.

const BY_NAME = new Map<string, string>();
const BY_PHONEME = new Map<string, string>();
/**
 * Noms de lettres ET remplissages tenant en PLUSIEURS mots (« i grec »,
 * « c'est tout »), indexés par la phrase normalisée : la valeur est la lettre,
 * ou `null` pour un remplissage (reconnu, mais n'écrit rien).
 */
const MULTI_PHRASES = new Map<string, string | null>();

function indexLetter(def: LetterNameDef): void {
  for (const name of def.names) {
    const norm = normalizeConjAnswer(name);
    if (norm.includes(' ')) MULTI_PHRASES.set(norm, def.letter);
    else BY_NAME.set(norm, def.letter);
  }
  for (const phoneme of def.phonemes) BY_PHONEME.set(phoneme, def.letter);
}
LETTER_NAMES.forEach(indexLetter);

const FILLERS = new Set<string>();
for (const filler of SPELLING_FILLERS) {
  const norm = normalizeConjAnswer(filler);
  if (norm.includes(' ')) MULTI_PHRASES.set(norm, null);
  else FILLERS.add(norm);
}

/** Longueur du plus long nom composé — dérivée, jamais maintenue à la main. */
const MAX_PHRASE_WORDS = Math.max(
  ...[...MULTI_PHRASES.keys()].map((phrase) => phrase.split(' ').length),
);

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
function tokenizeTranscript(transcript: string): Token[] {
  return transcript
    .split(/[^\p{L}'’]+/u)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeConjAnswer(raw) }));
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
  const norm = normalizeConjAnswer(word);
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
  if (!expectedForm) return false;
  const norm = normalizeConjAnswer(word);
  if (norm === normalizeConjAnswer(expectedForm)) return true;
  if (sameSound(dict ?? null, norm, expectedForm)) return true;
  return isPhoneticallyClose(norm, expectedForm);
}

/**
 * Lit une épellation dans un transcript. Fonction pure : c'est elle que les
 * tests couvrent, le composant vocal ne fait que l'appeler et afficher.
 */
export function parseSpelledLetters(
  transcript: string,
  { expectedForm, subject = '', dict = null, ignoreForm = false }: SpelledParseOptions,
): SpelledParse {
  const tokens = tokenizeTranscript(transcript);
  const subjectWords = new Set(tokenizeTranscript(subject).map((t) => t.norm));
  const letters: string[] = [];
  let saidForm = false;
  let junkAfterLetters = false;

  let i = 0;
  while (i < tokens.length) {
    // 1. Noms composés et remplissages sur plusieurs mots, le plus long d'abord.
    let consumed = 0;
    for (let size = Math.min(MAX_PHRASE_WORDS, tokens.length - i); size >= 2; size--) {
      const phrase = tokens
        .slice(i, i + size)
        .map((t) => t.norm)
        .join(' ');
      if (!MULTI_PHRASES.has(phrase)) continue;
      const letter = MULTI_PHRASES.get(phrase);
      if (letter) letters.push(letter);
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

    // 2. Le pronom de la question, redit avant d'épeler — et seulement avant
    //    la première lettre : après, « elle » est bien la lettre l (les doubles
    //    l s'épellent « elle, elle »).
    if (letters.length === 0 && subjectWords.has(token.norm)) continue;

    // 3. La forme dite avant l'épellation — seulement tant qu'aucune lettre
    //    n'est arrivée : après, un mot qui sonne comme la forme est du bruit.
    if (!ignoreForm && letters.length === 0 && matchesSpokenForm(token.norm, expectedForm, dict)) {
      saidForm = true;
      continue;
    }

    // 4. Une suite de capitales épelée d'un trait.
    const run = uppercaseRun(token);
    if (run) {
      letters.push(...run);
      continue;
    }

    // 5. Lettre seule, nom connu, ou appariement phonémique.
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

/**
 * La meilleure lecture parmi les hypothèses du recognizer (`maxAlternatives`) :
 * une épellation exploitable d'abord, à défaut une forme dite, à défaut le
 * constat d'échec. Les alternatives sont gratuites — le recognizer les fournit
 * avec le résultat — et souvent meilleures que l'hypothèse principale sur des
 * lettres isolées, où la principale part vers un vrai mot français.
 *
 * Paresseux : on s'arrête à la première épellation exploitable, sans lire les
 * hypothèses suivantes. Le cas nominal (la principale est la bonne) ne fait
 * donc qu'une lecture au lieu de cinq, sur le chemin d'un enfant qui attend.
 */
export function bestSpelledParse(
  candidates: string[],
  options: SpelledParseOptions,
): SpelledParse {
  let fallback: SpelledParse | null = null;
  for (const candidate of candidates) {
    const parse = parseSpelledLetters(candidate, options);
    if (parse.status === 'letters') return parse;
    // À défaut d'épellation : la première forme dite l'emporte sur le premier
    // constat d'échec — elle mène à « maintenant, épelle ! » plutôt qu'à un
    // « je n'ai pas bien entendu » qui serait faux.
    if (fallback === null || (fallback.status === 'unheard' && parse.status === 'form-only')) {
      fallback = parse;
    }
  }
  return fallback ?? { status: 'unheard', letters: [], answer: '', saidForm: false };
}

import { canonicalizeIrrWord, irrExpectedForms, irrSlotCount, type IrrVerbDef } from './irregularVerbs';

// === Réponse dite à voix haute, verbes irréguliers (specs §16.6) ===
//
// L'enfant DIT les formes, sans épeler : en anglais, « went » et « gone » ne
// se confondent avec aucune autre forme du même verbe, contrairement aux
// terminaisons muettes de la conjugaison. L'habitude de la classe est de
// réciter les trois formes (« go, went, gone ») ; dire seulement « went,
// gone » est aussi accepté.

/** Mots de remplissage ignorés : « to go… », « went and gone », « um… ». */
const FILLERS = new Set(['to', 'and', 'then', 'um', 'uh', 'er', 'erm', 'hmm', 'the']);

/**
 * Les mots d'une transcription, ramenés aux formes du verbe quand ce sont des
 * homophones connus (« eight » → « ate » pour « eat »), sans les mots de
 * remplissage.
 */
export function irrSpokenWords(transcript: string, def: IrrVerbDef): string[] {
  return transcript
    .split(/[\s,.;!?-]+/)
    .map((w) => canonicalizeIrrWord(w, def))
    .filter((w) => w !== '' && !FILLERS.has(w));
}

/**
 * L'infinitif récité en tête est-il à retirer ? Toujours quand il n'est pas
 * lui-même une forme attendue. Quand il l'est (« put, put, put », « come,
 * came, come »), seulement s'il y a un mot de trop : « put put » est alors la
 * réponse complète, pas un infinitif suivi d'une moitié de réponse.
 */
function stripBase(words: string[], def: IrrVerbDef): string[] {
  if (words[0] !== def.key) return words;
  const baseIsAnswer = irrExpectedForms(def).includes(def.key);
  if (!baseIsAnswer || words.length > irrSlotCount(def)) return words.slice(1);
  return words;
}

/**
 * Les formes entendues jusqu'ici, infinitif retiré — ce que l'écran affiche
 * dans les cases pendant que l'enfant parle. Peut être incomplet.
 */
export function irrHeardForms(words: string[], def: IrrVerbDef): string[] {
  return stripBase(words, def).slice(0, irrSlotCount(def));
}

/**
 * La réponse complète, ou null tant qu'il manque une forme : une réponse dite
 * en deux fois (« went »… « gone ») attend sa seconde moitié au lieu d'être
 * jugée fausse sur la première.
 */
export function irrSpokenAnswer(words: string[], def: IrrVerbDef): string[] | null {
  const heard = irrHeardForms(words, def);
  return heard.length === irrSlotCount(def) ? heard : null;
}

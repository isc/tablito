import {
  allIrrForms,
  canonicalizeIrrWord,
  irrExpectedForms,
  irrSlotCount,
  type IrrVerbDef,
} from './irregularVerbs';
import { editDistance } from './irregularComposer';

// === Réponse dite à voix haute, verbes irréguliers (specs §16.6) ===
//
// L'enfant DIT les formes, sans épeler : en anglais, « went » et « gone » ne
// se confondent avec aucune autre forme du même verbe, contrairement aux
// terminaisons muettes de la conjugaison. L'habitude de la classe est de
// réciter les trois formes (« go, went, gone ») ; dire seulement « went,
// gone » est aussi accepté.

/** Mots de remplissage ignorés : « to go… », « went and gone », « um… ». */
const FILLERS = new Set(['to', 'and', 'then', 'um', 'uh', 'er', 'erm', 'hmm', 'the']);

// --- Appariement au son -------------------------------------------------------
//
// La reconnaissance vocale cherche des PHRASES plausibles : « go, went, gone »
// n'en est pas une, et elle le réécrit volontiers en « go when gone » ou « go
// went gun ». La table d'homophones ne couvre que les cas connus d'avance.
// Chaque mot entendu qui n'est pas une forme de l'inventaire est donc ramené à
// la forme qui SONNE le plus près, parmi toutes celles de l'inventaire et les
// sur-régularisations du verbe interrogé (« goed ») — jamais seulement parmi
// les bonnes réponses : « thought » pour « bring » reste « thought », une
// erreur. Une forme dite telle quelle n'est jamais déplacée.

/**
 * Clé de prononciation approchée d'un mot anglais : graphies muettes ou
 * équivalentes ramenées à une seule (gh, kn, wr, ph, c dur, e final muet,
 * consonnes doublées), voyelles gardées — elles seules séparent sing, sang et
 * sung.
 */
export function irrSoundKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  w = w
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/^wh/, 'w')
    .replace(/(augh|ough)t/g, 'ot')
    .replace(/gh/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/y$/, 'i')
    .replace(/ea/g, 'e')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u');
  // E final muet (« gone », « made ») : la voyelle d'avant porte le son.
  if (w.length > 3 && /[^aeiou]e$/.test(w)) w = w.slice(0, -1);
  return w.replace(/(.)\1+/g, '$1');
}

let inventory: { form: string; key: string }[] | null = null;

/** Écart toléré entre deux clés : une lettre, deux à partir de quatre. */
function tolerance(key: string): number {
  return key.length <= 3 ? 1 : 2;
}

/**
 * Le mot entendu, ou la forme de l'inventaire qui sonne le plus près. À écart
 * égal, on préfère dans l'ordre : une forme ATTENDUE du verbe interrogé (c'est
 * elle que l'enfant cherchait à dire, plutôt que son infinitif), puis une forme
 * pas encore dite dans la phrase — « sing sang song » : « song » est aussi
 * près de sang que de sung, mais sang vient d'être dit.
 */
function snapToForm(word: string, def: IrrVerbDef, said: readonly string[]): string {
  inventory ??= [...allIrrForms()].map((form) => ({ form, key: irrSoundKey(form) }));
  const own = new Set([def.key, ...def.preterite, ...def.participle]);
  const expected = new Set(irrExpectedForms(def));
  // Sur-régularisations du verbe : « goed » doit rester « goed ».
  const regular = [`${def.key}ed`, `${def.key}d`];
  if (own.has(word) || regular.includes(word) || inventory.some((c) => c.form === word)) return word;
  const key = irrSoundKey(word);
  // Rang lexicographique : écart, puis forme attendue, puis forme du verbe,
  // puis forme pas encore dite.
  const rank = (form: string, formKey: string) => [
    editDistance(key, formKey),
    expected.has(form) ? 0 : 1,
    own.has(form) ? 0 : 1,
    said.includes(form) ? 1 : 0,
  ];
  let best: { form: string; rank: number[] } | null = null;
  for (const { form, key: formKey } of [
    ...inventory,
    ...regular.map((form) => ({ form, key: irrSoundKey(form) })),
  ]) {
    const r = rank(form, formKey);
    const i = best ? r.findIndex((x, j) => x !== best!.rank[j]) : 0;
    if (!best || (i >= 0 && r[i] < best.rank[i])) best = { form, rank: r };
  }
  return best && best.rank[0] <= tolerance(key) ? best.form : word;
}

/**
 * Les mots d'une transcription, ramenés aux formes du verbe quand ce sont des
 * homophones connus (« eight » → « ate » pour « eat ») ou qu'ils en sonnent
 * tout près (« when » → « went »), sans les mots de remplissage. `said` : les
 * formes déjà entendues sur la question (une réponse dite en deux fois).
 */
export function irrSpokenWords(transcript: string, def: IrrVerbDef, said: readonly string[] = []): string[] {
  const out: string[] = [];
  for (const raw of transcript.split(/[\s,.;!?-]+/)) {
    const w = canonicalizeIrrWord(raw, def);
    if (w === '' || FILLERS.has(w)) continue;
    out.push(snapToForm(w, def, [...said, ...out]));
  }
  return out;
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

import {
  allIrrForms,
  canonicalizeIrrWord,
  irrExpectedForms,
  irrSlotCount,
  type IrrVerbDef,
} from './irregularVerbs';
import { editDistance, judgeIrrAnswer } from './irregularComposer';

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
// n'en est pas une, et elle le réécrit volontiers en « go when gone », « stand
// Stuart stood » ou « write road written ». La table d'homophones ne couvre que
// les cas connus d'avance. On ne cherche donc pas à reconnaître le mot entendu
// parmi toutes les formes de l'inventaire, mais à VÉRIFIER la réponse attendue :
// un mot qui n'est pas une forme et qui en a à peu près le son compte pour elle.
// Une réponse n'est fausse que sur une preuve d'erreur : une forme du verbe
// interrogé (« began, began »), une sur-régularisation (« goed »), ou la forme
// d'un autre verbe qui ne sonne pas comme la bonne (« thought » pour « bring »).
// Ces trois-là, dites telles quelles, ne sont jamais déplacées.

/**
 * Clé de prononciation approchée d'un mot anglais : graphies muettes ou
 * équivalentes ramenées à une seule (gh, kn, wr, ph, c dur, e final muet,
 * consonnes doublées), voyelles gardées — elles seules séparent sing, sang et
 * sung. Sonores et sourdes sont confondues après la première lettre : un enfant
 * français dévoise la consonne finale, et l'anglais américain fait de « tt » et
 * « dd » le même battement — « wrote » et « rode », « written » et « ridden »
 * s'entendent pareil. La consonne initiale, elle, s'entend bien (« got » n'est
 * pas « caught »).
 */
function soundKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w === '') return '';
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
  w = w[0] + w.slice(1).replace(/d/g, 't').replace(/b/g, 'p').replace(/g/g, 'k').replace(/v/g, 'f');
  return w.replace(/(.)\1+/g, '$1');
}

/** Les consonnes seules : ce que la reconnaissance garde d'un mot mal entendu. */
function skeleton(key: string): string {
  return key.replace(/[aeiou]/g, '');
}

/** Écart toléré entre deux clés : une lettre, deux à partir de quatre. */
function tolerance(key: string): number {
  return key.length <= 3 ? 1 : 2;
}

/**
 * Le mot entendu a-t-il les consonnes de la forme attendue ? Toutes, ou toutes
 * à une près quand il y en a au moins trois (« Stuart » pour « stood »).
 */
function soundsLike(key: string, expectedKey: string): boolean {
  const [a, b] = [skeleton(key), skeleton(expectedKey)];
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 3 ? 1 : 0);
}

const withKey = (form: string) => ({ form, key: soundKey(form) });
type Keyed = ReturnType<typeof withKey>;

let inventory: Keyed[] | null = null;

/**
 * Le mot entendu, ou la forme qu'il était censé être.
 *
 * - Une forme du verbe interrogé, ou sa sur-régularisation, reste telle quelle.
 * - La forme d'un autre verbe reste telle quelle, sauf si elle sonne
 *   exactement comme une forme attendue (« ridden » pour « written »).
 * - Tout autre mot est une invention de la reconnaissance : il devient la
 *   forme du verbe la plus proche — une forme attendue dès qu'il en a les
 *   consonnes, les autres à une ou deux lettres de clé près —, et seulement à
 *   défaut celle d'un autre verbe. À écart égal, une forme attendue l'emporte
 *   (c'est elle que l'enfant cherchait à dire, plutôt que son infinitif), puis
 *   une forme pas encore dite — « sing sang song » : « song » est aussi près
 *   de sang que de sung, mais sang vient d'être dit.
 */
function snapToForm(word: string, def: IrrVerbDef, said: readonly string[]): string {
  // Sur-régularisations du verbe : « goed » doit rester « goed ».
  const own = [def.key, ...def.preterite, ...def.participle, `${def.key}ed`, `${def.key}d`];
  if (own.includes(word)) return word;
  const expected = irrExpectedForms(def);
  const key = soundKey(word);
  inventory ??= [...allIrrForms()].map(withKey);
  if (inventory.some((c) => c.form === word)) return expected.find((form) => soundKey(form) === key) ?? word;

  const closest = (candidates: Keyed[]) => {
    let best: { form: string; rank: number[] } | null = null;
    for (const { form, key: formKey } of candidates) {
      const distance = editDistance(key, formKey);
      const isExpected = expected.includes(form);
      if (distance > tolerance(key) && !(isExpected && soundsLike(key, formKey))) continue;
      const rank = [distance, isExpected ? 0 : 1, said.includes(form) ? 1 : 0];
      const i = best ? rank.findIndex((x, j) => x !== best!.rank[j]) : 0;
      if (!best || (i >= 0 && rank[i] < best.rank[i])) best = { form, rank };
    }
    return best?.form;
  };
  return closest(own.map(withKey)) ?? closest(inventory) ?? word;
}

/**
 * Participe en u (begun, sung, swum, rung, drunk) : la reconnaissance ne
 * l'écrit pas, elle écrit l'infinitif ou le prétérit (journaux vocaux des 20 et
 * 21/10/2026 : « begin began begin » ou « begin began began », à chaque fois).
 * Juste derrière le prétérit, dans le même énoncé, l'infinitif compte pour le
 * participe : réciter « began, begin » n'est pas une erreur qu'on fait, alors
 * que « began, began » en est une (cf. irrParticipleUnheard).
 */
function participleHeardAsBase(word: string, previous: string | undefined, def: IrrVerbDef): boolean {
  return def.family === 'iau' && word === def.key && previous === def.preterite[0];
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
    out.push(participleHeardAsBase(w, out.at(-1), def) ? def.participle[0] : snapToForm(w, def, [...said, ...out]));
  }
  return out;
}

/**
 * Les mots commencent-ils par l'infinitif récité ? Toujours quand il y a un mot
 * de trop pour les cases : c'est l'infinitif, même mal entendu (« girl went
 * gone » pour go). Sinon, quand c'est bien lui et qu'il n'est pas lui-même une
 * forme attendue — « put put » est la réponse complète, pas un infinitif suivi
 * d'une moitié de réponse.
 */
function recitesBase(words: readonly string[], def: IrrVerbDef): boolean {
  if (words.length > irrSlotCount(def)) return true;
  return words[0] === def.key && !irrExpectedForms(def).includes(def.key);
}

/**
 * Les mots entendus sur la question après un nouvel énoncé. Un énoncé qui
 * récite l'infinitif est une nouvelle récitation : il remplace les bribes
 * d'avant (« begin again »… « begin, began, begun ») au lieu de s'y ajouter.
 * Les autres complètent une réponse dite en plusieurs fois (« went »…
 * « gone »). Renvoie `said` lui-même quand l'énoncé n'apporte aucun mot.
 */
export function irrAccumulate(said: string[], transcript: string, def: IrrVerbDef): string[] {
  const words = irrSpokenWords(transcript, def, said);
  if (words.length === 0) return said;
  return recitesBase(words, def) ? words : [...said, ...words];
}

/**
 * Les formes entendues jusqu'ici, infinitif retiré — ce que l'écran affiche
 * dans les cases pendant que l'enfant parle. Peut être incomplet.
 */
export function irrHeardForms(words: string[], def: IrrVerbDef): string[] {
  return (recitesBase(words, def) ? words.slice(1) : words).slice(0, irrSlotCount(def));
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

/** La réponse dite est-elle juste ? */
export function irrVoiceCorrect(answer: string[] | null, def: IrrVerbDef): answer is string[] {
  return answer !== null && judgeIrrAnswer(def, answer, 'voice') === 'correct';
}

/**
 * La réponse à la fin d'un énoncé : complète, ou incomplète mais rendue juste
 * par sa dernière forme répétée — la reconnaissance avale les répétitions
 * (« tell, told, told » transcrit « tell told », « get, got, got » transcrit
 * « get god »). Il faut l'infinitif ET une forme : « put » seul, c'est l'enfant
 * qui lit la question. Jamais une réponse fausse : celle-là attend la suite.
 */
export function irrFinalAnswer(words: string[], def: IrrVerbDef): string[] | null {
  const heard = irrHeardForms(words, def);
  if (heard.length === irrSlotCount(def)) return heard;
  if (words.length < 2 || heard.length === 0) return null;
  const padded = [...heard];
  while (padded.length < irrSlotCount(def)) padded.push(heard[heard.length - 1]);
  return irrVoiceCorrect(padded, def) ? padded : null;
}

/**
 * Participe en u entendu comme le prétérit, derrière un prétérit juste
 * (« begin began began ») : c'est l'erreur classique, ou « begun » mal
 * transcrit. La voix ne peut pas trancher : ni juste ni faux, la question passe
 * au clavier. Renvoie les formes à y garder (le prétérit), ou null.
 */
export function irrParticipleUnheard(answer: readonly string[], def: IrrVerbDef): string[] | null {
  const [preterite, participle] = answer;
  const unheard = def.family === 'iau' && preterite === def.preterite[0] && participle === preterite;
  return unheard ? [preterite] : null;
}

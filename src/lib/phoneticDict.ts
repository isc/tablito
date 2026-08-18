// === Dictionnaire de prononciation (spec §15.10, mode vocal épelé) ===
//
// Projette un mot français sur ses phonèmes. C'est la brique qui rend
// l'appariement de l'épellation insensible à l'orthographe choisie par la
// reconnaissance vocale : « haine », « aine » et « enne » sont trois mots
// différents et un seul phonème /ɛn/, donc une seule lettre — n.
//
// Le fichier servi (`public/phonetic/fr.txt`, format `mot<TAB>phonèmes`) est
// ÉLAGUÉ : il ne contient que les mots dont la prononciation coïncide avec un
// nom de lettre ou avec une forme verbale de l'inventaire (cf.
// scripts/generate-phonetic-dict.mjs). L'élagage ne perd rien — un mot qui ne
// sonne comme aucune cible ne pourrait de toute façon apparier — et fait passer
// le dictionnaire de 6 Mo à quelques kilo-octets. C'est ce que veut dire « le
// vocabulaire est fermé » : une dizaine de noms de lettres, 111 formes.
//
// Chargement PARESSEUX et jamais bloquant : le fichier n'est demandé qu'à
// l'entrée en mode vocal (la matière est déjà fr-only, et le mode est
// optionnel), il vit dans son propre groupe de cache du service worker
// (`phonetic`, cf. LAZY_GROUPS dans scripts/build.mjs) et un échec de
// chargement dégrade au lieu de casser : l'appariement retombe sur ses étages
// orthographiques (lettre seule, nom connu).

const BASE = import.meta.env.BASE_URL;

/** Mot (minuscule) → prononciations en API, sans barres obliques. */
export type PhoneticDict = Map<string, readonly string[]>;

/**
 * Une entrée par ligne, `mot<TAB>phonème|phonème`. Le séparateur `|` liste les
 * variantes de prononciation d'un même mot (« est » → /ɛst/ ou /ɛ/) : il suffit
 * qu'UNE variante coïncide pour apparier.
 */
export function parsePhoneticDict(text: string): PhoneticDict {
  const dict: PhoneticDict = new Map();
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab <= 0) continue;
    const word = line.slice(0, tab).toLowerCase();
    const phonemes = line
      .slice(tab + 1)
      .trim()
      .split('|')
      .filter(Boolean);
    if (phonemes.length > 0 && !dict.has(word)) dict.set(word, phonemes);
  }
  return dict;
}

let loading: Promise<PhoneticDict | null> | null = null;

/**
 * Charge le dictionnaire (une seule fois par session, réponse mémoïsée).
 * Renvoie `null` si le fichier est absent ou illisible — appelant averti :
 * l'appariement doit fonctionner sans lui, en moins robuste.
 */
export function loadPhoneticDict(): Promise<PhoneticDict | null> {
  loading ??= (async () => {
    try {
      const res = await fetch(`${BASE}phonetic/fr.txt`);
      if (!res.ok) return null;
      return parsePhoneticDict(await res.text());
    } catch {
      return null;
    }
  })();
  return loading;
}

/** Prononciations d'un mot ; liste vide s'il est inconnu du dictionnaire. */
export function phonemesOf(dict: PhoneticDict | null, word: string): readonly string[] {
  if (!dict) return [];
  return dict.get(word.toLowerCase()) ?? [];
}

/** Deux mots sonnent-ils pareil ? (Faux dès que l'un des deux est inconnu.) */
export function sameSound(dict: PhoneticDict | null, a: string, b: string): boolean {
  const pa = phonemesOf(dict, a);
  if (pa.length === 0) return false;
  const pb = phonemesOf(dict, b);
  return pb.some((p) => pa.includes(p));
}

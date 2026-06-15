// Parse un nombre parlé anglais (0-100). Accepte les chiffres ("24", "7") et
// l'anglais canonique ("twenty-four", "seventy-one", "one hundred"). La grammaire
// de repli est partagée avec le français via makeSpokenNumberParser ; ce fichier
// ne porte que les spécificités anglaises (tables de mots, élision de "and",
// marqueurs d'égalité/multiplication).

import { makeSpokenNumberParser } from './spokenNumber';

const UNITS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function unitWord(n: number): string {
  for (const [w, v] of Object.entries(UNITS)) {
    if (v === n && w !== 'oh') return w;
  }
  return '';
}

function buildPhraseMap(): Map<string, number> {
  const m = new Map<string, number>();

  for (const [w, n] of Object.entries(UNITS)) m.set(w, n);
  for (const [w, n] of Object.entries(TEENS)) m.set(w, n);

  // 20..99 : "<tens>" et "<tens> <unit>"
  for (const [tw, tn] of Object.entries(TENS)) {
    m.set(tw, tn);
    for (let u = 1; u <= 9; u++) {
      m.set(`${tw} ${unitWord(u)}`, tn + u);
    }
  }

  m.set('hundred', 100);
  m.set('a hundred', 100);
  m.set('one hundred', 100);

  return m;
}

// Marqueurs d'égalité dans une équation parlée ("six times five equals thirty").
const EQUALITY_MARKER_RE =
  /(?:^|\s)(?:equals|equal|is|are|makes|make|thats|that is|it is|its)(?=\s|$)/g;

const { parseNumber: parseEnglishNumber, parseAnswer: parseEnglishAnswer } = makeSpokenNumberParser({
  phraseMap: buildPhraseMap(),
  // "and" est souvent inséré ("a hundred and one") — on l'élide pour ne pas
  // casser le matching exact.
  normalizeExtra: (s) => s.replace(/\band\b/g, ' '),
  equalityMarkerRe: EQUALITY_MARKER_RE,
  multiplicationMarkers: new Set(['times', 'x', 'by']),
});

export { parseEnglishNumber, parseEnglishAnswer };

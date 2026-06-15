// Parse un nombre parlé français (0-100). Accepte les chiffres ("24", "7") et le
// français canonique ("vingt-quatre", "soixante et onze", "quatre-vingts"). La
// grammaire de repli est partagée avec l'anglais via makeSpokenNumberParser ;
// ce fichier ne porte que les spécificités françaises (tables de mots, gestion
// des dizaines 70/80/90, "vin/vint" → "vingt", marqueurs d'égalité).

import { makeSpokenNumberParser } from './spokenNumber';

const UNITS: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
};

const TEENS: Record<string, number> = {
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  'dix sept': 17,
  'dix huit': 18,
  'dix neuf': 19,
};

const TENS: Record<string, number> = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
};

function unitWord(n: number): string {
  for (const [w, v] of Object.entries(UNITS)) {
    if (v === n && w !== 'une') return w;
  }
  return '';
}

function teenWord(n: number): string {
  for (const [w, v] of Object.entries(TEENS)) {
    if (v === n) return w;
  }
  return '';
}

function buildPhraseMap(): Map<string, number> {
  const m = new Map<string, number>();

  for (const [w, n] of Object.entries(UNITS)) m.set(w, n);
  for (const [w, n] of Object.entries(TEENS)) m.set(w, n);

  // 20..69 (regular tens)
  for (const [tw, tn] of Object.entries(TENS)) {
    m.set(tw, tn);
    m.set(`${tw}s`, tn);
    m.set(`${tw} et un`, tn + 1);
    m.set(`${tw} et une`, tn + 1);
    for (let u = 2; u <= 9; u++) {
      m.set(`${tw} ${unitWord(u)}`, tn + u);
    }
  }

  // 70..79 : "soixante-<teen>"
  for (let x = 10; x <= 19; x++) {
    const xw = teenWord(x);
    if (!xw) continue;
    m.set(`soixante ${xw}`, 60 + x);
    if (x === 11) m.set(`soixante et ${xw}`, 60 + x);
  }

  // 80..89 : "quatre-vingt[-u]"
  m.set('quatre vingt', 80);
  m.set('quatre vingts', 80);
  for (let u = 1; u <= 9; u++) {
    m.set(`quatre vingt ${unitWord(u)}`, 80 + u);
  }
  // "quatre-vingt-et-un" is archaic but sometimes pronounced
  m.set('quatre vingt et un', 81);

  // 90..99 : "quatre-vingt-<teen>"
  for (let x = 10; x <= 19; x++) {
    const xw = teenWord(x);
    if (!xw) continue;
    m.set(`quatre vingt ${xw}`, 80 + x);
  }

  m.set('cent', 100);

  return m;
}

// Marqueurs d'égalité dans une équation parlée. L'input est normalisé (espaces
// collapsés) avant matching, donc les bigrams comme "c est" / "ca fait" utilisent
// un espace littéral.
const EQUALITY_MARKER_RE =
  /(?:^|\s)(?:egale|egales|egalent|egal|font|vaut|valent|c est|ca fait|ca donne|ca vaut)(?=\s|$)/g;

const { parseNumber: parseFrenchNumber, parseAnswer: parseFrenchAnswer } = makeSpokenNumberParser({
  phraseMap: buildPhraseMap(),
  // Le STT entend souvent "vingt" comme "vin"/"vint" (t final muet) : on le remet
  // en amont pour que toute la logique de compounds fonctionne sans cas spécial.
  normalizeExtra: (s) => s.replace(/\b(vin|vint)\b/g, 'vingt'),
  equalityMarkerRe: EQUALITY_MARKER_RE,
  multiplicationMarkers: new Set(['fois', 'x']),
});

export { parseFrenchNumber, parseFrenchAnswer };

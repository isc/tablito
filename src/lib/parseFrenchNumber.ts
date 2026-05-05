// Parse a French-language spoken number (0-100) into an integer.
// Accepts:
//  - pure digit strings: "24", "7"
//  - canonical French: "vingt-quatre", "soixante et onze", "quatre-vingts"
// Returns null if the input cannot be interpreted as a number in range.
// Intentionally strict: "deux trois" is NOT parsed as 23. Accepting digit
// sequences creates false positives on TTS echo (hearing the question
// "2 × 3" as "deux trois" would submit 23 as the answer).

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

const PHRASE_MAP = buildPhraseMap();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\u2010-\u2015]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseFrenchNumber(input: string): number | null {
  const s = normalize(input);
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  if (PHRASE_MAP.has(s)) return PHRASE_MAP.get(s)!;

  return null;
}

// Marqueurs d'égalité dans une équation parlée. Si l'enfant répète la question
// avec sa réponse ("6 fois 5 égale 30"), on prend ce qui suit le dernier
// marqueur. Un écho TTS pur ("6 fois 5") n'a pas de marqueur et tombe dans
// la logique stricte ci-dessous.
// L'input est passé par `normalize` (espaces collapsés à un seul) avant matching,
// donc les bigrams comme "c est" / "ca fait" peuvent utiliser un espace littéral.
const EQUALITY_MARKER_RE =
  /(?:^|\s)(?:egale|egales|egalent|egal|font|vaut|valent|c est|ca fait|ca donne|ca vaut)(?=\s|$)/g;

function afterEqualityMarker(input: string): string | null {
  const s = normalize(input);
  let lastEnd = -1;
  for (const m of s.matchAll(EQUALITY_MARKER_RE)) {
    lastEnd = (m.index ?? 0) + m[0].length;
  }
  if (lastEnd === -1) return null;
  const tail = s.slice(lastEnd).trim();
  return tail || null;
}

// Parse a spoken answer in range 0..100. Tries the whole string, then the
// part après un marqueur d'égalité ("6 fois 5 égale 30" → 30), puis les
// trailing 2-3 tokens (handles filler words like "euh trente-deux"), then as
// a last resort the trailing single token — but only if the prefix contains
// no recognizable number word. Rationale : une compound cassé comme "quatre
// vingts un" (pluriel fautif) ne doit pas se replier sur "un" → 1, car
// l'enfant pensait dire 81. Préfère retourner null pour forcer un retry.
export function parseFrenchAnswer(input: string): number | null {
  const direct = parseFrenchNumber(input);
  if (direct !== null && direct >= 0 && direct <= 100) return direct;
  const afterMarker = afterEqualityMarker(input);
  if (afterMarker !== null) {
    const n = parseFrenchNumber(afterMarker);
    if (n !== null && n >= 0 && n <= 100) return n;
  }
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  for (let k = 2; k <= Math.min(3, tokens.length); k++) {
    const tail = tokens.slice(-k).join(' ');
    const n = parseFrenchNumber(tail);
    if (n !== null && n >= 0 && n <= 100) return n;
  }
  if (tokens.length >= 1) {
    const last = tokens[tokens.length - 1];
    const n = parseFrenchNumber(last);
    if (n === null || n < 0 || n > 100) return null;
    const prefix = tokens.slice(0, -1);
    // Reject si un token du préfixe est déjà un nombre — sinon on masque un
    // compound cassé en ne gardant que son dernier mot.
    if (prefix.every((t) => parseFrenchNumber(t) === null)) return n;
  }
  return null;
}

// Parse an English-language spoken number (0-100) into an integer.
// Accepts:
//  - pure digit strings: "24", "7"
//  - canonical English: "twenty-four", "seventy-one", "one hundred"
// Returns null if the input cannot be interpreted as a number in range.
// Intentionally strict: "two three" is NOT parsed as 23. Accepting loose digit
// sequences creates false positives on TTS echo (hearing the question
// "2 × 3" as "two three" would submit 23 as the answer).
//
// Pendant anglais de parseFrenchNumber.ts — même contrat, même stratégie de
// repli (parseEnglishAnswer). KEEP IN SYNC quand l'heuristique évolue.

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

const PHRASE_MAP = buildPhraseMap();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-‐-―]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    // "and" est souvent inséré ("a hundred and one" hors plage, mais aussi
    // dialectes) — on l'élide pour ne pas casser le matching exact.
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseEnglishNumber(input: string): number | null {
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
// avec sa réponse ("six times five equals thirty"), on prend ce qui suit le
// dernier marqueur. Un écho TTS pur ("six times five") n'a pas de marqueur.
const EQUALITY_MARKER_RE =
  /(?:^|\s)(?:equals|equal|is|are|makes|make|thats|that is|it is|its)(?=\s|$)/g;

// Marqueurs de multiplication : leur présence dans le préfixe d'un trailing
// token signale un écho de la question ("six times five") plutôt que des
// utterances accumulées.
const MULTIPLICATION_MARKERS = new Set(['times', 'x', 'by']);

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

// Parse a spoken answer in range 0..100. Même stratégie de repli que
// parseFrenchAnswer : chaîne entière, puis après marqueur d'égalité, puis les
// 2-3 derniers tokens, puis le dernier token seul (à condition que le préfixe
// ne contienne aucun mot-nombre composable ni marqueur de multiplication).
export function parseEnglishAnswer(input: string): number | null {
  const direct = parseEnglishNumber(input);
  if (direct !== null && direct >= 0 && direct <= 100) return direct;
  const afterMarker = afterEqualityMarker(input);
  if (afterMarker !== null) {
    const n = parseEnglishNumber(afterMarker);
    if (n !== null && n >= 0 && n <= 100) return n;
  }
  const tokens = normalize(input).split(/\s+/).filter(Boolean);
  for (let k = 2; k <= Math.min(3, tokens.length); k++) {
    const tail = tokens.slice(-k).join(' ');
    const n = parseEnglishNumber(tail);
    if (n !== null && n >= 0 && n <= 100) return n;
  }
  if (tokens.length >= 1) {
    const last = tokens[tokens.length - 1];
    const n = parseEnglishNumber(last);
    if (n === null || n < 0 || n > 100) return null;
    const prefix = tokens.slice(0, -1);
    const safe = prefix.every(
      (t) =>
        !MULTIPLICATION_MARKERS.has(t)
        && (parseEnglishNumber(t) === null || /^\d+$/.test(t)),
    );
    if (safe) return n;
  }
  return null;
}

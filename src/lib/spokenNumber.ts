// Cœur partagé du parsing de nombre parlé (0-100), paramétré par langue. Le
// français et l'anglais ne diffèrent que par leurs tables de mots, une réécriture
// de normalisation propre à la langue, et leurs marqueurs d'égalité/multiplication.
// La grammaire de repli (échec → après marqueur d'égalité → 2-3 derniers tokens →
// dernier token si préfixe sûr) est identique : elle vit ici, une seule fois.
//
// Stratégie volontairement stricte : "deux trois" / "two three" ne valent PAS 23
// — accepter les suites de chiffres créerait des faux positifs sur l'écho TTS
// (entendre la question "2 × 3" et soumettre 23 comme réponse).

export interface SpokenNumberConfig {
  // Table phrase canonique → valeur, déjà sous forme normalisée (minuscules,
  // espaces simples). Chaque langue construit la sienne (la grammaire des
  // dizaines diffère : soixante-dix/quatre-vingts vs seventy/eighty).
  phraseMap: Map<string, number>;
  // Réécriture spécifique à la langue, appliquée après la normalisation commune
  // (ex. FR : 'vin'/'vint' → 'vingt' ; EN : élision de 'and').
  normalizeExtra?: (s: string) => string;
  // Marqueurs d'égalité (regex globale) : on prend ce qui suit le dernier
  // ("6 fois 5 égale 30" → 30 ; "6 times 5 is 30" → 30).
  equalityMarkerRe: RegExp;
  // Marqueurs de multiplication : leur présence dans le préfixe d'un trailing
  // token signale un écho de la question plutôt que des utterances accumulées.
  multiplicationMarkers: Set<string>;
}

export interface SpokenNumberParser {
  parseNumber: (input: string) => number | null;
  parseAnswer: (input: string) => number | null;
}

export function makeSpokenNumberParser(config: SpokenNumberConfig): SpokenNumberParser {
  const { phraseMap, normalizeExtra, equalityMarkerRe, multiplicationMarkers } = config;

  function normalize(s: string): string {
    let r = s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[-‐-―]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');
    if (normalizeExtra) r = normalizeExtra(r);
    return r.replace(/\s+/g, ' ').trim();
  }

  function parseNumber(input: string): number | null {
    const s = normalize(input);
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    return phraseMap.has(s) ? phraseMap.get(s)! : null;
  }

  function afterEqualityMarker(input: string): string | null {
    const s = normalize(input);
    let lastEnd = -1;
    for (const m of s.matchAll(equalityMarkerRe)) {
      lastEnd = (m.index ?? 0) + m[0].length;
    }
    if (lastEnd === -1) return null;
    const tail = s.slice(lastEnd).trim();
    return tail || null;
  }

  // Parse une réponse parlée 0..100. Essaie la chaîne entière, puis la partie
  // après un marqueur d'égalité, puis les 2-3 derniers tokens (filler words type
  // "euh"/"um"), puis le dernier token seul — mais seulement si le préfixe ne
  // contient aucun mot-nombre composable ni marqueur de multiplication. Un
  // compound cassé ("quatre vingts un") doit retourner null plutôt que de se
  // replier sur "un" = 1.
  function parseAnswer(input: string): number | null {
    const direct = parseNumber(input);
    if (direct !== null && direct >= 0 && direct <= 100) return direct;

    const afterMarker = afterEqualityMarker(input);
    if (afterMarker !== null) {
      const n = parseNumber(afterMarker);
      if (n !== null && n >= 0 && n <= 100) return n;
    }

    const tokens = normalize(input).split(/\s+/).filter(Boolean);
    for (let k = 2; k <= Math.min(3, tokens.length); k++) {
      const tail = tokens.slice(-k).join(' ');
      const n = parseNumber(tail);
      if (n !== null && n >= 0 && n <= 100) return n;
    }

    if (tokens.length >= 1) {
      const last = tokens[tokens.length - 1];
      const n = parseNumber(last);
      if (n === null || n < 0 || n > 100) return null;
      const prefix = tokens.slice(0, -1);
      // Deux nombres en chiffres ne forment jamais un compound — on débloque
      // "37 27" (utterances accumulées). Le marqueur "fois"/"times" garde le
      // rejet de l'écho TTS pur ("6 fois 5" → null).
      const safe = prefix.every(
        (t) => !multiplicationMarkers.has(t) && (parseNumber(t) === null || /^\d+$/.test(t)),
      );
      if (safe) return n;
    }
    return null;
  }

  return { parseNumber, parseAnswer };
}

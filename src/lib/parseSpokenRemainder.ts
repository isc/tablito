import type { Lang } from '../i18n/lang';
import { parseSpokenAnswer } from './parseSpokenNumber';
import { normalizeSpokenText } from './spokenNumber';

// Réponse parlée du niveau 3 (specs §12.5). L'enfant peut tout dire d'un
// trait — « six, reste trois », « six et il reste trois », « six, ça tombe
// juste » — ou s'arrêter au quotient, et l'app relance « Et il reste
// combien ? ». À l'étape du reste, « rien » et « ça tombe juste » valent 0.
//
// Le parseur de nombres sait déjà extraire une réponse d'une phrase ; on ne
// fait ici que couper la phrase au marqueur de reste et reconnaître le « zéro »
// dit en mots.

export interface SpokenRemainderAnswer {
  quotient: number;
  // null : l'enfant n'a donné que le quotient.
  remainder: number | null;
}

interface RemainderGrammar {
  // Marqueur entre quotient et reste, avec ce qui le précède immédiatement
  // (« et il ») pour que le quotient reste propre.
  marker: RegExp;
  // Façons de dire « reste nul » sans chiffre.
  zero: RegExp;
}

const GRAMMAR: Record<Lang, RemainderGrammar> = {
  fr: {
    marker: /(?:^|\s)(?:et\s+)?(?:il\s+)?(?:en\s+)?rest(?:e|es|ent)?(?=\s|$)/,
    zero: /(?:^|\s)(?:rien|aucun|pile|(?:ca\s+)?tombe\s+juste)(?=\s|$)/,
  },
  en: {
    marker: /(?:^|\s)(?:and\s+|with\s+)?(?:a\s+)?(?:remainder(?:\s+of)?|r)(?=\s|$)/,
    zero: /(?:^|\s)(?:nothing|none|no\s+remainder|exactly)(?=\s|$)/,
  },
};

function withoutMarker(s: string, lang: Lang): string {
  return s.replace(GRAMMAR[lang].marker, ' ').trim();
}

/**
 * Réponse à l'étape du quotient, reste éventuellement compris. null quand
 * aucun quotient ne s'en dégage — l'écho de la relance « Et il reste
 * combien ? » en fait partie, et doit être ignoré.
 */
export function parseSpokenQuotientAndRemainder(
  input: string,
  lang: Lang,
): SpokenRemainderAnswer | null {
  const s = normalizeSpokenText(input);
  const { marker, zero } = GRAMMAR[lang];

  // Reste nul dit en mots, APRÈS le quotient (« six, ça tombe juste », « six
  // reste rien ») : testé d'abord, « no remainder » contenant lui-même le
  // marqueur anglais. Placé avant tout nombre (« pile six »), il ne dit rien
  // du reste : on retombe sur les autres lectures.
  const z = zero.exec(s);
  if (z) {
    const quotient = parseSpokenAnswer(withoutMarker(s.slice(0, z.index), lang), lang);
    if (quotient !== null) return { quotient, remainder: 0 };
  }

  const m = marker.exec(s);
  if (m) {
    const quotient = parseSpokenAnswer(s.slice(0, m.index), lang);
    if (quotient === null) return null;
    const after = s.slice(m.index + m[0].length).trim();
    return { quotient, remainder: after ? parseSpokenAnswer(after, lang) : null };
  }

  const quotient = parseSpokenAnswer(s, lang);
  if (quotient === null) return null;
  // Au niveau 3, quotient et reste n'ont qu'un chiffre (tables de 2 à 9). Un
  // nombre à deux chiffres est donc une phrase que le recognizer a fusionnée,
  // marqueur avalé : « quatre reste zéro » transcrit « 40 » (vécu sur Chrome
  // Android, même famille que « huit huit » → 88).
  if (quotient >= 10 && quotient <= 99) return { quotient: Math.floor(quotient / 10), remainder: quotient % 10 };
  return { quotient, remainder: null };
}

/** Le reste (étape 2) : un nombre, ou 0 dit en mots. */
export function parseSpokenRemainder(input: string, lang: Lang): number | null {
  // L'enfant qui répète toute sa phrase après la relance (« six reste trois »)
  // donne le reste en second : le lire comme tel, pas comme « six trois ».
  const pair = parseSpokenQuotientAndRemainder(input, lang);
  if (pair?.remainder != null) return pair.remainder;
  // « il reste trois », « reste rien » : le marqueur n'apporte rien ici.
  const s = withoutMarker(normalizeSpokenText(input), lang);
  if (!s) return null;
  if (GRAMMAR[lang].zero.test(s)) return 0;
  return parseSpokenAnswer(s, lang);
}

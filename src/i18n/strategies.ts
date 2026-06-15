import { pickStrings, useStrings, type Lang } from './lang';
import type { StrategyKind } from '../lib/strategies';

// Textes des stratégies de dérivation (titre + lignes de calcul). Les lignes
// sont surtout de la notation mathématique (langue-neutre) ; seuls les
// connecteurs ("On compte :" / "Count:") et les titres sont traduits. KEEP IN
// SYNC conceptuellement avec scripts/generate-tts.mjs (strategyText) qui énonce
// ces mêmes astuces à l'oral.

export interface StrategyTemplate {
  kind: StrategyKind;
  title: string;
  lines: (other: number, product: number) => string[];
}

const fr: ReadonlyArray<readonly [number, StrategyTemplate]> = [
  [9, {
    kind: 'near-ten',
    title: '× 9, c’est comme × 10 mais on enlève une fois.',
    lines: (n, p) => [`${n} × 9 = ${n} × 10 − ${n}`, `= ${n * 10} − ${n}`, `= ${p}`],
  }],
  [5, {
    kind: 'skip-count',
    title: '× 5, c’est compter par 5.',
    lines: (n, p) => {
      const sequence = Array.from({ length: n }, (_, i) => (i + 1) * 5).join(' → ');
      const sum = Array.from({ length: n }, () => '5').join(' + ');
      return [`${n} × 5 = ${sum}`, `On compte : ${sequence}`, `= ${p}`];
    },
  }],
  [3, {
    kind: 'double-add',
    title: '× 3, c’est × 2 plus une fois.',
    lines: (n, p) => [`${n} × 3 = ${n} × 2 + ${n}`, `= ${n * 2} + ${n}`, `= ${p}`],
  }],
  [4, {
    kind: 'double-double',
    title: '× 4, c’est le double de × 2.',
    lines: (n, p) => [`${n} × 4 = (${n} × 2) × 2`, `= ${n * 2} × 2`, `= ${p}`],
  }],
  [6, {
    kind: 'five-plus-one',
    title: '× 6, c’est × 5 plus une fois.',
    lines: (n, p) => [`${n} × 6 = ${n} × 5 + ${n}`, `= ${n * 5} + ${n}`, `= ${p}`],
  }],
  [7, {
    kind: 'five-plus-two',
    title: '× 7, c’est × 5 plus × 2.',
    lines: (n, p) => [`${n} × 7 = ${n} × 5 + ${n} × 2`, `= ${n * 5} + ${n * 2}`, `= ${p}`],
  }],
  [8, {
    kind: 'double-double-double',
    title: '× 8, c’est doubler trois fois.',
    lines: (n, p) => [
      `${n} × 8 = ${n} × 2 × 2 × 2`,
      `= ${n * 2} × 2 × 2`,
      `= ${n * 4} × 2`,
      `= ${p}`,
    ],
  }],
];

const en: ReadonlyArray<readonly [number, StrategyTemplate]> = [
  [9, {
    kind: 'near-ten',
    title: '× 9 is like × 10, then take one away.',
    lines: (n, p) => [`${n} × 9 = ${n} × 10 − ${n}`, `= ${n * 10} − ${n}`, `= ${p}`],
  }],
  [5, {
    kind: 'skip-count',
    title: '× 5 is counting by 5s.',
    lines: (n, p) => {
      const sequence = Array.from({ length: n }, (_, i) => (i + 1) * 5).join(' → ');
      const sum = Array.from({ length: n }, () => '5').join(' + ');
      return [`${n} × 5 = ${sum}`, `Count: ${sequence}`, `= ${p}`];
    },
  }],
  [3, {
    kind: 'double-add',
    title: '× 3 is × 2 plus one more.',
    lines: (n, p) => [`${n} × 3 = ${n} × 2 + ${n}`, `= ${n * 2} + ${n}`, `= ${p}`],
  }],
  [4, {
    kind: 'double-double',
    title: '× 4 is double of × 2.',
    lines: (n, p) => [`${n} × 4 = (${n} × 2) × 2`, `= ${n * 2} × 2`, `= ${p}`],
  }],
  [6, {
    kind: 'five-plus-one',
    title: '× 6 is × 5 plus one more.',
    lines: (n, p) => [`${n} × 6 = ${n} × 5 + ${n}`, `= ${n * 5} + ${n}`, `= ${p}`],
  }],
  [7, {
    kind: 'five-plus-two',
    title: '× 7 is × 5 plus × 2.',
    lines: (n, p) => [`${n} × 7 = ${n} × 5 + ${n} × 2`, `= ${n * 5} + ${n * 2}`, `= ${p}`],
  }],
  [8, {
    kind: 'double-double-double',
    title: '× 8 is doubling three times.',
    lines: (n, p) => [
      `${n} × 8 = ${n} × 2 × 2 × 2`,
      `= ${n * 2} × 2 × 2`,
      `= ${n * 4} × 2`,
      `= ${p}`,
    ],
  }],
];

const strategyTemplates: Record<Lang, ReadonlyArray<readonly [number, StrategyTemplate]>> = {
  fr,
  en,
};

export function getStrategyTemplates(): ReadonlyArray<readonly [number, StrategyTemplate]> {
  return pickStrings(strategyTemplates);
}

// === Division : « pense à la multiplication » ===
interface DivisionStrategyText {
  title: string;
  intro: (dividend: number, divisor: number) => string;
  conclusion: (dividend: number, divisor: number, quotient: number) => string;
}

const divisionFr: DivisionStrategyText = {
  title: 'Pense à la multiplication',
  intro: (dividend, divisor) =>
    `${dividend} ÷ ${divisor}, c'est : ${divisor} fois combien font ${dividend} ?`,
  conclusion: (dividend, divisor, quotient) => `Donc ${dividend} ÷ ${divisor} = ${quotient}.`,
};

const divisionEn: DivisionStrategyText = {
  title: 'Think multiplication',
  intro: (dividend, divisor) =>
    `${dividend} ÷ ${divisor} means: ${divisor} times what makes ${dividend}?`,
  conclusion: (dividend, divisor, quotient) => `So ${dividend} ÷ ${divisor} = ${quotient}.`,
};

const divisionStrategyText: Record<Lang, DivisionStrategyText> = {
  fr: divisionFr,
  en: divisionEn,
};

export function getDivisionStrategyText(): DivisionStrategyText {
  return pickStrings(divisionStrategyText);
}

// === Strings d'UI des cartes d'astuce (StrategyHint / DivisionStrategyHint) ===
interface StrategyHintStrings {
  eyebrowMult: (label: string) => string;
  eyebrowDiv: string;
  tenRecall: string;
  missingFactorAria: string;
}

const hintFr: StrategyHintStrings = {
  eyebrowMult: (label) => `L'astuce du ${label}`,
  eyebrowDiv: "L'astuce",
  tenRecall:
    "Rappel : pour × 10, les chiffres glissent d'une place vers la gauche et un 0 prend la place des unités.",
  missingFactorAria: 'le nombre à trouver',
};

const hintEn: StrategyHintStrings = {
  eyebrowMult: (label) => `The ${label} trick`,
  eyebrowDiv: 'The trick',
  tenRecall:
    'Reminder: for × 10, the digits shift one place to the left and a 0 takes the units place.',
  missingFactorAria: 'the number to find',
};

const strategyHintStrings: Record<Lang, StrategyHintStrings> = { fr: hintFr, en: hintEn };

export function useStrategyHintStrings(): StrategyHintStrings {
  return useStrings(strategyHintStrings);
}

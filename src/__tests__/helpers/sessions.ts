import type { SessionResult } from '../../types';

// Une séance de maths ordinaire (10 questions, 8 bonnes, 3 s par réponse), à
// ajuster champ par champ. Sous `helpers/` et sans suffixe `.test`, donc jamais
// collecté par vitest — même convention que `helpers/dom.ts`.
export function makeSession(date: string, over: Partial<SessionResult> = {}): SessionResult {
  return {
    date,
    kind: 'mult',
    questionsCount: 10,
    correctCount: 8,
    averageTimeMs: 3000,
    newFactsIntroduced: 0,
    factsPromoted: 0,
    ...over,
  };
}

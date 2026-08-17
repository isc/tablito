import type { BoxLevel, ConjFact } from '../types';
import { conjFastThresholdMs } from '../types';
import { computeNextDue } from './leitner';
import { conjFactDef, resolveConjQuestion } from './conjugationFacts';

// === Test de placement de la conjugaison (spec Verbito §6.1) ===
//
// C'est le PREMIER GESTE DE RÉASSURANCE du jeu, pas un examen : ≤ 15 questions,
// difficulté croissante, bouton « Je ne sais pas », arrêt après 3 échecs
// consécutifs. Il ensemence les boîtes Leitner — donc l'image mystère démarre
// déjà partiellement révélée, et le message d'ouverture passe sans un mot : tu
// n'as pas tout oublié, regarde tout ce qui est déjà là.
//
// Même structure que lib/placement.ts côté multiplication ; la différence, c'est
// la DOMINANCE. En multiplication elle se calcule (un fait (a,b) est dominé par
// tout (eA≥a, eB≥b)). En conjugaison il n'existe pas d'ordre numérique : la
// dominance est donc ÉNUMÉRÉE, sonde par sonde, et n'est affirmée que là où
// elle est défendable (réussir « vous chanterez » démontre la terminaison -ez
// ET la règle du futur — l'exemple même de la spec).

export interface ConjPlacementProbe {
  /** Fait testé. */
  key: string;
  /** Phrase porteuse utilisée — figée : le MP3 est pré-généré. */
  carrierIndex: number;
  /** Faits DÉMONTRÉS par une réussite sur cette sonde (§6.1). */
  implies: readonly string[];
}

/**
 * Les 15 sondes, en difficulté croissante : présent régulier → présent
 * irrégulier → imparfait → futur. Combiné à l'arrêt à 3 échecs, cet ordre évite
 * d'épuiser l'enfant sur ce qu'il ne sait pas encore.
 *
 * L'ordre respecte aussi les interférences (§3.4) : deux sondes confusibles ne
 * se suivent jamais (ont/vont séparés, êtes/faites séparés, futur -ai jamais
 * collé à imparfait -ais).
 */
export const CONJ_PLACEMENT_PROBES: readonly ConjPlacementProbe[] = [
  { key: 'pres-g1-nous', carrierIndex: 1, implies: [] }, // nous chantons
  { key: 'pres-etre-je', carrierIndex: 0, implies: [] }, // je suis
  // « ils jouent » : la marque muette, la plus ratée du bloc — la réussir,
  // c'est tenir tout le présent du 1er groupe.
  {
    key: 'pres-g1-ils',
    carrierIndex: 0,
    implies: ['pres-g1-je', 'pres-g1-tu', 'pres-g1-il', 'pres-g1-nous', 'pres-g1-vous'],
  },
  { key: 'pres-avoir-ils', carrierIndex: 0, implies: [] }, // ils ont
  { key: 'pres-etre-vous', carrierIndex: 0, implies: [] }, // vous êtes
  { key: 'pres-aller-ils', carrierIndex: 0, implies: [] }, // ils vont
  { key: 'pres-faire-vous', carrierIndex: 0, implies: [] }, // vous faites
  // « ils viennent » : le doublement du n, plus dur que le singulier.
  { key: 'pres-venir-ils', carrierIndex: 0, implies: ['pres-venir-jetu', 'pres-venir-il'] },
  { key: 'imp-je', carrierIndex: 0, implies: [] }, // je chantais
  // « nous jouions » : -ions est plus dur que -ais/-ait (le i s'entend à peine).
  { key: 'imp-nous', carrierIndex: 2, implies: ['imp-je', 'imp-tu', 'imp-il'] },
  { key: 'imp-etre', carrierIndex: 0, implies: [] }, // j'étais
  { key: 'fut-je', carrierIndex: 0, implies: [] }, // je chanterai
  // L'exemple de la spec, au verbe près (« vous parlerez ») ⇒ la terminaison
  // -ez ET la règle du futur (l'infinitif entier comme radical).
  {
    key: 'fut-vous',
    carrierIndex: 0,
    implies: ['fut-je', 'fut-tu', 'fut-il', 'fut-nous', 'fut-ils', 'pres-g1-vous'],
  },
  // « nous serons » : radical irrégulier + terminaison -ons du futur.
  { key: 'fut-etre', carrierIndex: 1, implies: ['fut-nous'] },
  { key: 'fut-voir', carrierIndex: 1, implies: ['fut-nous'] }, // nous verrons
];

export const CONJ_MAX_CONSECUTIVE_FAILURES = 3;

export interface ConjPlacementResult {
  key: string;
  /** « Je ne sais pas » est un échec sans réponse : correct = false. */
  correct: boolean;
  timeMs: number;
}

/**
 * Boîte de départ d'un fait réussi. Le seuil dépend de la LONGUEUR de la
 * réponse (conjFastThresholdMs) : placer « ons » et « viendront » sur le même
 * chrono pénaliserait mécaniquement les formes longues.
 */
function boxFromResult(result: ConjPlacementResult, expected: string): BoxLevel {
  const fast = conjFastThresholdMs(expected);
  if (result.timeMs < fast) return 3;
  if (result.timeMs < fast * 2) return 2;
  return 1;
}

function expectedOf(key: string, carrierIndex: number): string | null {
  const def = conjFactDef(key);
  if (!def) return null;
  return resolveConjQuestion(def, carrierIndex).expected;
}

function place(fact: ConjFact, box: BoxLevel, today: string): void {
  fact.introduced = true;
  fact.box = box;
  fact.lastSeen = today;
  fact.nextDue = computeNextDue(box, today);
}

/**
 * Ensemence les boîtes à partir des résultats du placement.
 *
 * Passe 1 — les faits directement testés ET réussis, à la boîte que dit leur
 * vitesse. Un raté (faux ou « Je ne sais pas ») n'est PAS placé : le placement
 * diagnostique un plancher, il ne charge pas la boîte 1.
 *
 * Passe 2 — les faits démontrés par dominance (`implies`), à la boîte de la
 * sonde qui les démontre : une preuve INDIRECTE ne peut pas placer plus haut
 * que la preuve directe qui la porte (une sonde réussie en 25 s vaut boîte 1,
 * les faits qu'elle démontre aussi). Sans cette passe, les faits jamais testés
 * resteraient `introduced: false` : l'image mystère les cacherait et
 * `shouldIntroduceNew` se bloquerait au premier fait laissé en boîte 1.
 *
 * Comme au niveau maths, aucun `history` n'est ajouté (le placement est un
 * calibrage, pas une révision) et un fait testé-et-raté n'est jamais rattrapé
 * par la dominance : l'enfant vient de dire qu'il ne le connaît pas.
 */
export function seedConjFromPlacement(
  facts: ConjFact[],
  results: ConjPlacementResult[],
  today: string,
): void {
  if (results.length === 0) return;

  const byKey = new Map(facts.map((f) => [f.key, f]));
  const probeByKey = new Map(CONJ_PLACEMENT_PROBES.map((p) => [p.key, p]));
  const testedKeys = new Set(results.map((r) => r.key));

  for (const result of results) {
    if (!result.correct) continue;
    const fact = byKey.get(result.key);
    const probe = probeByKey.get(result.key);
    if (!fact || !probe) continue;
    const expected = expectedOf(result.key, probe.carrierIndex);
    if (expected === null) continue;
    place(fact, boxFromResult(result, expected), today);
  }

  for (const result of results) {
    if (!result.correct) continue;
    const probe = probeByKey.get(result.key);
    if (!probe) continue;
    const expected = expectedOf(result.key, probe.carrierIndex);
    if (expected === null) continue;
    const box = boxFromResult(result, expected);

    for (const impliedKey of probe.implies) {
      if (testedKeys.has(impliedKey)) continue;
      const fact = byKey.get(impliedKey);
      if (!fact) continue;
      // Une dominance ne fait jamais REDESCENDRE un fait déjà mieux placé.
      if (fact.introduced && fact.box >= box) continue;
      place(fact, box, today);
    }
  }
}

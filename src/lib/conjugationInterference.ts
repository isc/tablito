import type { BoxLevel } from '../types';
import { conjFactDef, type ConjFactDef } from './conjugationFacts';

// === Interférences de la conjugaison (spec Verbito §3.4) ===
//
// Transposition directe du principe Tablito (Dotan & Zviran-Ginat 2022, cf.
// lib/similarity.ts) : deux faits trop proches ne cohabitent jamais dans une
// même série tant qu'ils ne sont pas consolidés, et leurs INTRODUCTIONS sont
// espacées d'au moins 48 h. La différence avec la multiplication, c'est que la
// similarité n'est pas calculable (pas d'opérandes partagés) : elle est
// énumérée, parce que les confusions de la conjugaison sont connues et peu
// nombreuses.

/** Boîte à partir de laquelle un fait est considéré consolidé (§3.4). */
export const CONJ_CONSOLIDATED_BOX: BoxLevel = 3;

/** Espacement minimal entre deux introductions de faits en interférence. */
export const CONJ_INTRO_SPACING_DAYS = 2;

/**
 * Groupes de confusion énumérés (§3.4). Tous les membres d'un groupe sont en
 * interférence deux à deux.
 *
 * - les quatre monosyllabes en -ont : sont / ont / vont / font. Leur air de
 *   famille (ils → -nt) est présenté comme une régularité APRÈS maîtrise
 *   individuelle, jamais avant ;
 * - tu es / il est ;
 * - le groupe vous → -ez est traité à part (cf. `ezRole`) : il oppose trois
 *   formes à une RÈGLE, pas trois clés à trois clés.
 */
export const CONJ_INTERFERENCE_GROUPS: readonly (readonly string[])[] = [
  ['pres-etre-ils', 'pres-avoir-ils', 'pres-aller-ils', 'pres-faire-ils'],
  ['pres-etre-tu', 'pres-etre-il'],
];

/**
 * L'interférence inter-temps majeure (§3.4) : futur -ai / imparfait -ais à la
 * 1re personne. Traitée à part car son statut s'INVERSE avec la consolidation :
 * proscrite en phase d'apprentissage, puis délibérément entrelacée une fois les
 * deux faits en boîte ≥ 3 — c'est l'entrelacement qui construit la
 * discrimination (Rohrer & Taylor 2007).
 */
export const CONJ_CONTRAST_PAIR: readonly [string, string] = ['fut-je', 'imp-je'];

/**
 * Rôle d'un fait vis-à-vis de la règle « vous → -ez » :
 * - 'regular'   : le fait porte bien la marque -ez (vous chantez, vous avez,
 *                 vous irez…) ;
 * - 'exception' : le fait est une des trois formes qui violent la règle
 *                 (vous êtes, vous faites, vous dites) ;
 * - 'none'      : le fait ne concerne pas la 2e personne du pluriel, ou porte
 *                 une autre marque (l'imparfait -iez, qui n'entre pas dans le
 *                 conflit : c'est une marque distincte).
 */
export function ezRole(def: ConjFactDef): 'regular' | 'exception' | 'none' {
  if (!def.persons.includes('vous')) return 'none';
  if (def.kind === 'ending') return def.ending === 'ez' ? 'regular' : 'none';
  if (def.kind === 'stem') return 'regular'; // radical + terminaison régulière -ez
  const mark = def.segment?.[1] ?? '';
  if (mark === 'ez') return 'regular';
  return 'exception';
}

const GROUP_OF = new Map<string, number>();
CONJ_INTERFERENCE_GROUPS.forEach((group, i) => {
  for (const key of group) GROUP_OF.set(key, i);
});

/**
 * Les deux faits sont-ils en interférence ? Prédicat symétrique, faux sur un
 * fait avec lui-même (une question ne s'auto-interfère pas).
 */
export function conjFactsInterfere(a: ConjFactDef, b: ConjFactDef): boolean {
  if (a.key === b.key) return false;

  const groupA = GROUP_OF.get(a.key);
  if (groupA !== undefined && groupA === GROUP_OF.get(b.key)) return true;

  const roleA = ezRole(a);
  const roleB = ezRole(b);
  // Une exception contre la règle, ou deux exceptions entre elles (faites /
  // dites sont confusibles l'une avec l'autre autant qu'avec -ez).
  if (roleA === 'exception' && roleB !== 'none') return true;
  if (roleB === 'exception' && roleA !== 'none') return true;

  return isConjContrastPair(a, b);
}

/** Variante par clés, pour les appelants qui n'ont que l'état Leitner. */
export function conjKeysInterfere(a: string, b: string): boolean {
  const defA = conjFactDef(a);
  const defB = conjFactDef(b);
  if (!defA || !defB) return false;
  return conjFactsInterfere(defA, defB);
}

/** La paire futur -ai / imparfait -ais (§3.4), dans un sens ou dans l'autre. */
export function isConjContrastPair(a: ConjFactDef, b: ConjFactDef): boolean {
  const [x, y] = CONJ_CONTRAST_PAIR;
  return (a.key === x && b.key === y) || (a.key === y && b.key === x);
}

/**
 * Deux faits peuvent-ils cohabiter dans une même séance ?
 *
 * Non tant qu'ils sont en interférence ET qu'au moins l'un des deux n'est pas
 * consolidé (boîte < 3). Une fois les deux consolidés, la cohabitation devient
 * souhaitable : c'est la phase d'entrelacement délibéré.
 */
export function canConjCoexist(
  a: { key: string; box: BoxLevel },
  b: { key: string; box: BoxLevel },
): boolean {
  if (!conjKeysInterfere(a.key, b.key)) return true;
  return a.box >= CONJ_CONSOLIDATED_BOX && b.box >= CONJ_CONSOLIDATED_BOX;
}

/**
 * Deux faits peuvent-ils être posés l'un JUSTE APRÈS l'autre ?
 *
 * Plus strict que la cohabitation : même consolidés, deux faits confusibles
 * restent séparés dans la série — SAUF la paire de contraste futur/imparfait,
 * dont l'adjacence est précisément l'objectif une fois les deux en boîte ≥ 3.
 */
export function canConjBeAdjacent(
  a: { key: string; box: BoxLevel },
  b: { key: string; box: BoxLevel },
): boolean {
  const defA = conjFactDef(a.key);
  const defB = conjFactDef(b.key);
  if (!defA || !defB) return true;
  if (!conjFactsInterfere(defA, defB)) return true;
  if (!isConjContrastPair(defA, defB)) return false;
  return a.box >= CONJ_CONSOLIDATED_BOX && b.box >= CONJ_CONSOLIDATED_BOX;
}

// Affichage d'une forme verbale SEGMENTÉE radical|terminaison en deux couleurs
// (spec Verbito §2.3, §8). C'est l'équivalent conceptuel de la grille de points
// du côté maths : le support visuel permanent qui rend la structure du fait
// lisible d'un coup d'œil, aux introductions comme aux corrections.
//
// Bowers, Kirby & Deacon (2010) : l'enseignement explicite de la morphologie
// (base + affixes) bénéficie à la littératie, avec un effet PLUS FORT chez les
// lecteurs les moins avancés. Bonus dyslexie : la segmentation réduit l'unité
// visuelle à traiter d'un coup.

import type { ReactNode } from 'react';

/**
 * Ce qui est « illuminé » (spec §5.2 étape 2, §5.3 cas erreur) : le pronom
 * d'abord, puis sa marque — c'est l'accord sujet/verbe qu'on met en scène. La
 * marque ne s'allume jamais seule : elle s'ajoute au pronom déjà allumé, c'est
 * l'ACCORD qui est mis en scène, pas la terminaison.
 */
export type ConjLit = 'none' | 'subject' | 'both';

interface ConjFormProps {
  /**
   * Segmentation radical|terminaison de la forme, telle que la produit
   * `resolveConjQuestion` : `['chant', 'ons']`, `['ser', 'ons']`…
   *
   * Une terminaison VIDE n'est pas un oubli, c'est une information : les formes
   * insécables (sommes, êtes, faites, dites) sont précisément celles qu'on ne
   * peut pas décomposer, et le composant les rend alors d'un seul tenant.
   */
  segment: readonly [string, string];
  /** Pronom sujet, espace ou apostrophe comprise : « nous », « j’ ». */
  subject?: string;
  /** Début de phrase porteuse, marqueur temporel compris : « Demain, ». */
  before?: string;
  /** Fin de phrase porteuse : « des crêpes. ». */
  after?: string;
  lit?: ConjLit;
}

export default function ConjForm({
  segment,
  subject,
  before,
  after,
  lit = 'none',
}: ConjFormProps) {
  const [stem, mark] = segment;
  const subjectLit = lit !== 'none';
  const markLit = lit === 'both';

  return (
    <span className="conj-form">
      {before && <span className="conj-form-context">{before} </span>}
      {subject && (
        // L'éventuelle espace finale du pronom (« nous ») reste HORS du span :
        // la pastille d'illumination doit épouser le mot, pas son espacement —
        // et cette espace est ce qui sépare visuellement les deux pastilles
        // quand pronom et marque sont adjacents (« je suis »).
        <>
          <span className={`conj-form-subject${subjectLit ? ' is-lit' : ''}`}>
            {subject.trimEnd()}
          </span>
          {subject.slice(subject.trimEnd().length)}
        </>
      )}
      <span className="conj-form-stem">{stem}</span>
      {/* Pas de <span> vide pour les formes insécables : « nous sommes » doit se
          lire comme un bloc, pas comme un radical suivi d'un trou. */}
      {mark !== '' && (
        <span className={`conj-form-mark${markLit ? ' is-lit' : ''}`}>{mark}</span>
      )}
      {after && <span className="conj-form-context">{after}</span>}
    </span>
  );
}

/**
 * Mini-balisage des textes d'astuce (conjugationStrategies) : `*ons*` rend une
 * terminaison dans la couleur des marques, `_chant_` un radical dans celle des
 * radicaux — les mêmes couleurs que la forme segmentée affichée au-dessus.
 * Les délimiteurs sont retirés au rendu, le texte nu reste lisible tel quel.
 */
export function renderConjHintLine(line: string): ReactNode {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/);
  if (parts.length === 1) return line;
  return parts.map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? (
      <b key={i} className="conj-hint-mark">{part.slice(1, -1)}</b>
    ) : part.startsWith('_') && part.endsWith('_') ? (
      <b key={i} className="conj-hint-stem">{part.slice(1, -1)}</b>
    ) : (
      part
    ),
  );
}

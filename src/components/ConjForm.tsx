// Affichage d'une forme verbale SEGMENTÉE radical|terminaison en deux couleurs
// (spec Verbito §2.3, §8). C'est l'équivalent conceptuel de la grille de points
// du côté maths : le support visuel permanent qui rend la structure du fait
// lisible d'un coup d'œil, aux introductions comme aux corrections.
//
// Bowers, Kirby & Deacon (2010) : l'enseignement explicite de la morphologie
// (base + affixes) bénéficie à la littératie, avec un effet PLUS FORT chez les
// lecteurs les moins avancés. Bonus dyslexie : la segmentation réduit l'unité
// visuelle à traiter d'un coup.

/**
 * Ce qui est « illuminé » (spec §5.2 étape 2, §5.3 cas erreur) : le pronom
 * d'abord, puis sa marque — c'est l'accord sujet/verbe qu'on met en scène.
 */
export type ConjLit = 'none' | 'subject' | 'mark' | 'both';

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
  size?: 'normal' | 'large';
}

export default function ConjForm({
  segment,
  subject,
  before,
  after,
  lit = 'none',
  size = 'normal',
}: ConjFormProps) {
  const [stem, mark] = segment;
  const subjectLit = lit === 'subject' || lit === 'both';
  const markLit = lit === 'mark' || lit === 'both';

  return (
    <span className={`conj-form conj-form--${size}`}>
      {before && <span className="conj-form-context">{before} </span>}
      {subject && (
        <span className={`conj-form-subject${subjectLit ? ' is-lit' : ''}`}>{subject}</span>
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

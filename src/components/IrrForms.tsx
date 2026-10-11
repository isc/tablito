import type { IrrVerbDef } from '../lib/irregularVerbs';

interface IrrFormsProps {
  def: IrrVerbDef;
  /**
   * Contenu des cases, dans l'ordre (prétérit(s), puis participe) : une forme,
   * ou null pour une case vide. Absent = les formes justes, affichées en
   * entier (introduction, correction).
   */
  slots?: readonly (string | null)[];
  /** Case en cours de saisie, soulignée. */
  activeSlot?: number;
  /** Taille : `large` pour la question et l'introduction. */
  size?: 'large' | 'normal';
  /** Cases cliquables (saisie au clavier) : le clic choisit la case à remplir. */
  onSlotClick?: (index: number) => void;
}

/**
 * La récitation d'un verbe irrégulier, « go → went → gone » (specs §16.5) :
 * l'infinitif en encre, les formes à produire en couleur. Les deux prétérits
 * de « be » partagent une même place, séparés d'une barre.
 */
export default function IrrForms({ def, slots, activeSlot, size = 'normal', onSlotClick }: IrrFormsProps) {
  const shown = slots ?? [...def.preterite, def.participle.join(' / ')];
  const n = def.preterite.length;

  const slot = (value: string | null, i: number) => {
    const className = `irr-form irr-form--slot${value === null ? ' is-blank' : ''}${
      activeSlot === i ? ' is-active' : ''
    }`;
    return onSlotClick ? (
      <button
        key={i}
        type="button"
        className={`${className} is-clickable`}
        // Pas de focus au clic souris : Entrée ou espace, ensuite, valident la
        // case au clavier physique au lieu de re-cliquer ce bouton.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSlotClick(i)}
        aria-pressed={activeSlot === i}
      >
        {value ?? ' '}
      </button>
    ) : (
      <span key={i} className={className}>
        {value ?? ' '}
      </span>
    );
  };

  return (
    <div className={`irr-forms irr-forms--${size}`}>
      <span className="irr-form irr-form--base" lang="en">
        {def.key}
      </span>
      <span className="irr-arrow" aria-hidden="true">→</span>
      <span className="irr-form-group" lang="en">
        {shown.slice(0, n).flatMap((value, i) =>
          i === 0 ? [slot(value, i)] : [<span key={`sep-${i}`} className="irr-sep">/</span>, slot(value, i)],
        )}
      </span>
      <span className="irr-arrow" aria-hidden="true">→</span>
      <span className="irr-form-group" lang="en">
        {slot(shown[n] ?? null, n)}
      </span>
    </div>
  );
}

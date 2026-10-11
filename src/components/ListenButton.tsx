interface ListenButtonProps {
  /** Libellé pour les lecteurs d'écran : le bouton n'a que son icône. */
  label: string;
  onClick: () => void;
  /** Placement par le point d'appel (l'apparence, elle, est ici). */
  className?: string;
}

/**
 * Bouton d'écoute icône seule, rond, cible de 44 px : la réécoute d'un énoncé
 * (conjugaison, verbes irréguliers) comme l'écoute d'une règle. Un seul dessin
 * pour un seul geste — et une icône vectorielle, pas l'émoji 🔊 dont le rendu
 * change d'un système à l'autre.
 */
export default function ListenButton({ label, onClick, className }: ListenButtonProps) {
  return (
    <button
      type="button"
      className={className ? `listen-btn ${className}` : 'listen-btn'}
      onClick={onClick}
      aria-label={label}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11 5 L6 9 H3 V15 H6 L11 19 Z M15.5 8.5 A5 5 0 0 1 15.5 15.5 M18.5 5.5 A9 9 0 0 1 18.5 18.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

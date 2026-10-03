interface ListenButtonProps {
  onClick: () => void;
  label: string;
}

/**
 * Bouton « Écouter » d'une règle : l'enfant qui lit encore lentement se fait
 * lire la règle. Icône seule, libellé pour les lecteurs d'écran.
 */
export default function ListenButton({ onClick, label }: ListenButtonProps) {
  return (
    <button type="button" className="listen-btn" onClick={onClick} aria-label={label}>
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

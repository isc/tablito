
interface MascotProps {
  mood: 'happy' | 'idle' | 'celebrate';
}

// Piou — mascotte stable : stage unique, taille unique. Seule l'humeur
// change (idle / happy / celebrate) via animations CSS. SVG inline pour
// un rendu identique sur tous les navigateurs et pour animer les parties
// (corps, ailes, yeux) indépendamment.
//
// ⚠ Le SVG ci-dessous est dupliqué dans index.html (#static-landing) pour
// que la landing reste 100 % HTML sans charger Preact. Si tu modifies
// Piou (ajout d'une partie, repositionnement), mets à jour les deux
// fichiers. Aucun outil ne détecte le drift.
const MASCOT_NAME = 'Piou';

export default function Mascot({ mood }: MascotProps) {
  return (
    <div
      className={`mascot ${mood}`}
      role="img"
      aria-label={`Mascotte ${MASCOT_NAME}, humeur: ${mood}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="mascot-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* pattes */}
        <g className="mascot-feet">
          <path d="M40 88 L 40 94 M 36 94 L 44 94" />
          <path d="M60 88 L 60 94 M 56 94 L 64 94" />
        </g>

        <g className="mascot-body">
          {/* corps */}
          <ellipse cx="50" cy="60" rx="28" ry="28" className="mascot-fill-body" />
          {/* ventre */}
          <path d="M32 60 Q 50 82 68 60" className="mascot-fill-belly" />
          {/* aile gauche — anime sur happy/celebrate */}
          <path
            d="M30 58 Q 26 70 36 74 Q 40 68 38 60 Z"
            className="mascot-wing"
          />
          {/* œil gauche */}
          <g className="mascot-eye mascot-eye-left">
            <circle cx="43" cy="54" r="3" className="mascot-eye-iris" />
            <circle cx="44" cy="53" r="0.9" className="mascot-eye-shine" />
          </g>
          {/* œil droit */}
          <g className="mascot-eye mascot-eye-right">
            <circle cx="57" cy="54" r="3" className="mascot-eye-iris" />
            <circle cx="58" cy="53" r="0.9" className="mascot-eye-shine" />
          </g>
          {/* bec */}
          <path d="M46 63 L 54 63 L 50 68 Z" className="mascot-beak" />
          {/* joues */}
          <circle cx="38" cy="62" r="2.5" className="mascot-cheek" />
          <circle cx="62" cy="62" r="2.5" className="mascot-cheek" />
          {/* houppette */}
          <path d="M48 34 L 50 28 L 52 34" className="mascot-tuft" />
        </g>
      </svg>
    </div>
  );
}

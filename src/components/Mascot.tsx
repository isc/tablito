import { useMascotStrings } from '../i18n/progress';

interface MascotProps {
  mood: 'happy' | 'idle' | 'celebrate' | 'flyaway';
}

// Piou — mascotte stable : stage unique, taille unique. Seule l'humeur
// change (idle / happy / celebrate) via animations CSS. SVG inline pour
// un rendu identique sur tous les navigateurs et pour animer les parties
// (corps, ailes, yeux) indépendamment.
//
// ⚠ Le SVG ci-dessous est dupliqué à deux autres endroits : index.html
// (#static-landing, pour que la landing reste 100 % HTML sans charger Preact)
// et landing-video/composition/index.html (scène de marque de la vidéo hero,
// rendue hors de l'app). Si tu modifies Piou (ajout d'une partie,
// repositionnement), mets à jour les trois copies. Aucun outil ne détecte le drift.
const MASCOT_NAME = 'Piou';

export default function Mascot({ mood }: MascotProps) {
  const t = useMascotStrings();
  return (
    <div
      className={`mascot ${mood}`}
      role="img"
      aria-label={t.ariaLabel(MASCOT_NAME, mood)}
    >
      <svg
        viewBox="0 0 100 100"
        className="mascot-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* pattes — top à y=68 (caché derrière le corps qui descend
            jusqu'à y=90), doigts à y=94-97. Pendant le cheer le corps monte
            de ~12 unités ET tilte de ±6° : au droit des pattes le bas du
            corps remonte alors à ~y=76, donc le haut de patte doit rester
            au-dessus pour ne pas exposer un trou entre corps et pattes. */}
        <g className="mascot-feet">
          <path d="M42 68 L 42 94 M 42 94 L 37 97 M 42 94 L 47 97" />
          <path d="M58 68 L 58 94 M 58 94 L 53 97 M 58 94 L 63 97" />
        </g>

        <g className="mascot-body">
          {/* houppette — deux plumes, rendues avant le corps qui en
              recouvre la base */}
          <path
            d="M50 31 C 45 25 46 18 51 17 C 50 22 52 27 50 31 Z"
            className="mascot-tuft"
          />
          <path
            d="M50 31 C 53 24 58 22 62 24 C 58 25 54 28 50 31 Z"
            className="mascot-tuft"
          />
          {/* corps (en poire) */}
          <path
            d="M50 30 C 70 30 80 48 80 64 C 80 80 67 90 50 90 C 33 90 20 80 20 64 C 20 48 30 30 50 30 Z"
            className="mascot-fill-body"
          />
          {/* ventre */}
          <ellipse cx="50" cy="75" rx="18" ry="11.5" className="mascot-fill-belly" />
          {/* yeux ouverts — masqués en celebrate au profit des yeux « ^^ » */}
          <g className="mascot-eyes-open">
            <g className="mascot-eye mascot-eye-left">
              <circle cx="41" cy="57" r="4.3" className="mascot-eye-iris" />
              <circle cx="42.5" cy="55.4" r="1.5" className="mascot-eye-shine" />
              <circle cx="39.8" cy="58.8" r="0.6" className="mascot-eye-shine" />
            </g>
            <g className="mascot-eye mascot-eye-right">
              <circle cx="59" cy="57" r="4.3" className="mascot-eye-iris" />
              <circle cx="60.5" cy="55.4" r="1.5" className="mascot-eye-shine" />
              <circle cx="57.8" cy="58.8" r="0.6" className="mascot-eye-shine" />
            </g>
          </g>
          <g className="mascot-eyes-closed">
            <path d="M36.5 58.5 Q 41 52.5 45.5 58.5" />
            <path d="M54.5 58.5 Q 59 52.5 63.5 58.5" />
          </g>
          {/* bec */}
          <path
            d="M45.5 63.5 Q 50 61.5 54.5 63.5 Q 50 69.5 45.5 63.5 Z"
            className="mascot-beak"
          />
          {/* joues */}
          <ellipse cx="33.5" cy="65" rx="4" ry="2.4" className="mascot-cheek" />
          <ellipse cx="66.5" cy="65" rx="4" ry="2.4" className="mascot-cheek" />
          {/* ailes — rendues après les joues. Animent sur happy/celebrate,
              en miroir (cf. --wing-dir dans Mascot.css). */}
          <path
            d="M22 60 Q 11 68 18 79 Q 25 77 27 66 Z"
            className="mascot-wing mascot-wing-left"
          />
          <path
            d="M78 60 Q 89 68 82 79 Q 75 77 73 66 Z"
            className="mascot-wing mascot-wing-right"
          />
        </g>
      </svg>
    </div>
  );
}

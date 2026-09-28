// Barre de maîtrise de l'accueil de l'espace parent : le résumé d'une matière
// en paliers (cf. masteryBuckets), quand sa page détaille les boîtes (cf.
// ParentBoxChart). L'appelant calcule la répartition : il en affiche aussi le
// compte des maîtrisées.
//
// Rendue en <span> et non en <div> : elle vit à l'intérieur de la carte-bouton
// d'une matière, où seul du contenu « phrasing » est valide.

import type { MasteryBuckets } from '../lib/leitner';
import { useParentDashboardStrings } from '../i18n/parent';

// Du plus solide au plus fragile. Les « pas encore vues » n'ont pas de segment :
// c'est le fond de la barre, ce qui reste à parcourir.
const SEGMENTS = ['mastered', 'onTrack', 'fragile'] as const;

interface MasteryBarProps {
  buckets: MasteryBuckets;
  total: number;
}

export default function MasteryBar({ buckets, total }: MasteryBarProps) {
  const t = useParentDashboardStrings();
  return (
    <span className="parent-mastery-bar" role="img" aria-label={t.masteryBarLabel(buckets.mastered, total)}>
      {SEGMENTS.map((b) => (
        <span
          key={b}
          className={`parent-mastery-seg parent-mastery-seg--${b}`}
          style={{ width: `${(buckets[b] / Math.max(total, 1)) * 100}%` }}
        />
      ))}
    </span>
  );
}

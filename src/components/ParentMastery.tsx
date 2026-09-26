// Barre de maîtrise de l'espace parent : quatre paliers lisibles par un parent
// (maîtrisées, en bonne voie, à consolider, pas encore vues) au lieu des boîtes
// B1 à B5, que la grille Leitner de la page de matière continue de montrer.
//
// Rendue en <span> et non en <div> : sur l'accueil, elle vit à l'intérieur de
// la carte-bouton d'une matière, où seul du contenu « phrasing » est valide.

import { useMemo } from 'react';
import type { BoxLevel } from '../types';
import { masteryBuckets, type MasteryBuckets } from '../lib/leitner';
import { useParentDashboardStrings } from '../i18n/parent';

type Bucket = keyof MasteryBuckets;

// Du plus solide au plus fragile. Les « pas encore vues » n'ont pas de segment :
// c'est le fond de la barre, ce qui reste à parcourir.
const BUCKETS: Bucket[] = ['mastered', 'onTrack', 'fragile', 'unseen'];

interface MasteryBarProps {
  facts: { box: BoxLevel; introduced: boolean }[];
  // Légende chiffrée sous la barre (page de matière) ; l'accueil s'en passe.
  legend?: boolean;
}

export default function MasteryBar({ facts, legend = false }: MasteryBarProps) {
  const t = useParentDashboardStrings();
  const buckets = useMemo(() => masteryBuckets(facts), [facts]);
  const total = Math.max(facts.length, 1);
  const labels: Record<Bucket, string> = {
    mastered: t.bucketMastered,
    onTrack: t.bucketOnTrack,
    fragile: t.bucketFragile,
    unseen: t.bucketUnseen,
  };

  return (
    <>
      <span
        className="parent-mastery-bar"
        role="img"
        aria-label={t.masteryBarLabel(buckets.mastered, facts.length)}
      >
        {BUCKETS.filter((b) => b !== 'unseen').map((b) => (
          <span
            key={b}
            className={`parent-mastery-seg parent-mastery-seg--${b}`}
            style={{ width: `${(buckets[b] / total) * 100}%` }}
          />
        ))}
      </span>
      {legend && (
        <ul className="parent-mastery-legend">
          {BUCKETS.map((b) => (
            <li key={b} className="parent-mastery-legend-item" data-bucket={b}>
              <span className={`parent-mastery-swatch parent-mastery-seg--${b}`} aria-hidden="true" />
              <span className="parent-mastery-legend-label">{labels[b]}</span>
              <span className="parent-mastery-legend-count">{buckets[b]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

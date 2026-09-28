// Répartition d'un niveau par boîte, sur la page de matière de l'espace
// parent : les faits pas encore vus, puis B1 à B5, chacune avec son compte et
// la couleur de ses cases dans la grille Leitner qui suit, dont elle est la
// légende chiffrée. Pourquoi les boîtes et non les paliers de l'accueil :
// specs §5.2.

import type { BoxLevel } from '../types';
import { boxCounts, MASTERY_BOX } from '../lib/leitner';
import { useParentDashboardStrings } from '../i18n/parent';

interface ParentBoxChartProps {
  facts: Array<{ box: BoxLevel; introduced: boolean }>;
}

export default function ParentBoxChart({ facts }: ParentBoxChartProps) {
  const t = useParentDashboardStrings();
  const counts = boxCounts(facts);
  const max = Math.max(...counts, 1);

  return (
    <>
      <div className="parent-box-chart" role="img" aria-label={t.boxChartLabel(counts)}>
        {counts.map((count, box) => (
          <div key={box} className="parent-box-col" data-box={box}>
            <span className="parent-box-count">{count}</span>
            <span
              className="parent-box-fill"
              style={{ '--share': count / max, background: `var(--box${box})` } as React.CSSProperties}
            />
            <span className="parent-box-label">{box === 0 ? t.boxUnseenShort : `B${box}`}</span>
          </div>
        ))}
      </div>
      <p className="parent-card-caption">{t.masteredFromBox(MASTERY_BOX)}</p>
    </>
  );
}

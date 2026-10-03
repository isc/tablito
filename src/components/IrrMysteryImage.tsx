import { useMemo } from 'react';
import type { IrrFact, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import IrrForms from './IrrForms';
import { irrGridIndex, irrRecitation, irrVerbDefs } from '../lib/irregularVerbs';

interface IrrMysteryImageProps {
  facts: IrrFact[];
  theme: MysteryTheme;
}

/**
 * Image mystère des verbes irréguliers (specs §16.9) : 64 verbes pour 64
 * cases, la grille 8×8 se remplit exactement. Ordre des cases : celui de
 * l'inventaire (la fréquence), donc l'image se dévoile dans l'ordre où l'enfant
 * apprend.
 */
export default function IrrMysteryImage({ facts, theme }: IrrMysteryImageProps) {
  const factMap = useMemo(() => new Map(facts.map((f) => [f.key, f])), [facts]);
  const defs = irrVerbDefs();

  const cellFor = (row: number, col: number): MysteryCell => {
    const def = defs[irrGridIndex(row, col)];
    const fact = factMap.get(def.key);
    const label = irrRecitation(def);
    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: label,
      detailHeading: label,
      detailBody: (
        <div className="irr-mystery-detail">
          <IrrForms def={def} />
          <div className="irr-translation">{def.fr}</div>
        </div>
      ),
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} showHeaders={false} />;
}

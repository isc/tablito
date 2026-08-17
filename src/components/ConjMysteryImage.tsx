import { useMemo } from 'react';
import type { ConjFact, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import ConjForm from './ConjForm';
import {
  CONJ_FACT_DEFS,
  conjSubject,
  resolveConjQuestion,
} from '../lib/conjugationFacts';
import { conjStrings as t } from '../i18n/conjugation';

interface ConjMysteryImageProps {
  facts: ConjFact[];
  theme: MysteryTheme;
}

// Ordre des cases : celui de l'inventaire (présent, puis imparfait, puis
// futur), donc l'image se dévoile grosso modo dans l'ordre où l'enfant
// apprend — débloquer l'imparfait puis le futur « ouvre de nouvelles zones de
// la même image, encore sous la brume » (spec §7.1).
const ORDERED_KEYS: readonly string[] = CONJ_FACT_DEFS.map((d) => d.key);

/**
 * Image mystère de la matière conjugaison (spec Verbito §7.1). UNE seule image
 * couvre les trois temps : la factorisation en règles rend les temps trop
 * inégaux (44 / 7 / 12 faits) pour porter chacun la sienne — celle de
 * l'imparfait serait révélée en trois séances.
 */
export default function ConjMysteryImage({ facts, theme }: ConjMysteryImageProps) {
  const factMap = useMemo(() => {
    const m = new Map<string, ConjFact>();
    for (const f of facts) m.set(f.key, f);
    return m;
  }, [facts]);

  // Case bonus : allumée seulement quand les 63 faits sont découverts, au
  // niveau du plus fragile d'entre eux.
  const bonus = useMemo(() => {
    const known = ORDERED_KEYS.map((k) => factMap.get(k)).filter((f) => f?.introduced);
    if (known.length < ORDERED_KEYS.length) return null;
    return Math.min(...known.map((f) => f!.box));
  }, [factMap]);

  const cellFor = (row: number, col: number): MysteryCell => {
    // Les en-têtes de MysteryGrid valent 2..9 (héritage des tables) ; ici ils ne
    // servent qu'à situer la case, d'où la conversion en rang de 0 à 63.
    const index = (row - 2) * 8 + (col - 2);

    if (index >= ORDERED_KEYS.length) {
      return {
        level: bonus ?? 0,
        introduced: bonus !== null,
        ariaLabel: t.mysteryBonusLabel,
        detailHeading: t.mysteryBonusHeading,
        detailBody: <p className="conj-mystery-detail">{t.mysteryBonusText}</p>,
        box: (bonus ?? 1) as MysteryCell['box'],
      };
    }

    const key = ORDERED_KEYS[index];
    const fact = factMap.get(key);
    const def = CONJ_FACT_DEFS[index];
    // La porteuse 0 suffit : on n'affiche pas la phrase, seulement la forme.
    const view = resolveConjQuestion(def, 0);
    const label = `${conjSubject(view.person, view.form)}${view.form}`;

    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: label,
      // Titre en texte simple, corps en couleurs : même partage qu'en maths
      // (« 7 × 8 = 56 » puis la grille de points). Ici le support conceptuel,
      // c'est la segmentation radical|terminaison (§2.3).
      detailHeading: label,
      detailBody: (
        <p className="conj-mystery-detail">
          <ConjForm
            segment={view.segment}
            subject={conjSubject(view.person, view.form)}
            size="large"
          />
        </p>
      ),
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} />;
}

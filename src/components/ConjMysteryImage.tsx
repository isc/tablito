import { useMemo } from 'react';
import type { ConjFact, ConjLevel, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import ConjForm from './ConjForm';
import { conjGrid } from '../lib/conjugationFacts';
import { conjStrings as t } from '../i18n/conjugation';

interface ConjMysteryImageProps {
  facts: ConjFact[];
  theme: MysteryTheme;
  /** Niveau de la matière : chacun a son image (specs §15.8). */
  level?: ConjLevel;
}

/**
 * Image mystère de la matière conjugaison (spec Verbito §7.1). UNE seule image
 * couvre les trois temps du niveau 1 : la factorisation en règles rend les temps
 * trop inégaux (44 / 7 / 12 faits) pour porter chacun la sienne — celle de
 * l'imparfait serait révélée en trois séances. Le niveau 2 a la sienne, sur une
 * grille plus petite : ses 23 faits ne remplissent pas 64 cases.
 *
 * Ordre des cases : celui de l'inventaire (présent, puis imparfait, puis
 * futur), donc l'image se dévoile grosso modo dans l'ordre où l'enfant
 * apprend — débloquer l'imparfait puis le futur « ouvre de nouvelles zones de
 * la même image, encore sous la brume » (spec §7.1).
 */
export default function ConjMysteryImage({ facts, theme, level = 1 }: ConjMysteryImageProps) {
  const factMap = useMemo(() => {
    const m = new Map<string, ConjFact>();
    for (const f of facts) m.set(f.key, f);
    return m;
  }, [facts]);

  // Libellé et segmentation des cases : ils ne dépendent que de
  // l'inventaire, jamais de l'état Leitner. Dérivés UNE fois au montage — les
  // résoudre dans `cellFor` les recalculait 64 fois à chaque rendu de grille,
  // donc à chaque tap sur une case.
  const grid = useMemo(() => conjGrid(level), [level]);

  // Case bonus : allumée seulement quand tous les faits du niveau sont découverts,
  // au niveau du plus fragile d'entre eux.
  const bonus = useMemo(() => {
    const known = grid.views.map((v) => factMap.get(v.def.key)).filter((f) => f?.introduced);
    if (known.length < grid.views.length) return null;
    return Math.min(...known.map((f) => f!.box));
  }, [factMap, grid]);

  const cellFor = (row: number, col: number): MysteryCell => {
    const view = grid.viewAt(row, col);

    // Case au-delà des faits du niveau : la grille est carrée, l'inventaire non.
    if (!view) {
      return {
        level: bonus ?? 0,
        introduced: bonus !== null,
        ariaLabel: t.mysteryBonusLabel,
        detailHeading: t.mysteryBonusHeading,
        detailBody: <p className="conj-mystery-detail">{t.mysteryBonusText}</p>,
        box: (bonus ?? 1) as MysteryCell['box'],
      };
    }

    const fact = factMap.get(view.def.key);

    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: view.label,
      // Titre en texte simple, corps en couleurs : même partage qu'en maths
      // (« 7 × 8 = 56 » puis la grille de points). Ici le support conceptuel,
      // c'est la segmentation radical|terminaison (§2.3).
      detailHeading: view.label,
      detailBody: (
        <p className="conj-mystery-detail">
          <ConjForm segment={view.segment} subject={view.subject} />
        </p>
      ),
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} size={grid.size} />;
}

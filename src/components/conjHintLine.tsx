// Mini-balisage des textes d'astuce de la conjugaison. Vit hors de ConjForm.tsx
// (qui exporte un composant) : mêler exports de composants et de fonctions dans
// un même module casse le fast refresh en dev — c'est ce que dit la règle
// react-refresh/only-export-components.

import type { ReactNode } from 'react';

/**
 * Mini-balisage des textes d'astuce (conjugationStrategies) : `*ons*` rend une
 * terminaison dans la couleur des marques, `_chant_` un radical dans celle des
 * radicaux — les mêmes couleurs que la forme segmentée affichée au-dessus.
 * Les délimiteurs sont retirés au rendu, le texte nu reste lisible tel quel.
 */
export function renderConjHintLine(line: string): ReactNode {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/);
  if (parts.length === 1) return line;
  return parts.map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? (
      <b key={i} className="conj-hint-mark">{part.slice(1, -1)}</b>
    ) : part.startsWith('_') && part.endsWith('_') ? (
      <b key={i} className="conj-hint-stem">{part.slice(1, -1)}</b>
    ) : (
      part
    ),
  );
}

// Mini-balisage des textes d'astuce de la conjugaison. Vit hors de ConjForm.tsx
// (qui exporte un composant) : mêler exports de composants et de fonctions dans
// un même module casse le fast refresh en dev — c'est ce que dit la règle
// react-refresh/only-export-components.

import type { ReactNode } from 'react';

/**
 * Mini-balisage des textes de règle (conjugationRules.ts) : `*ons*` rend une
 * terminaison dans la couleur des marques, `_chant_` un radical dans celle des
 * radicaux — les mêmes couleurs que la forme segmentée affichée au-dessus —,
 * `^ais^` une terminaison illuminée (la pastille de la forme segmentée) et
 * `~ons~` des lettres qu'on enlève, barrées. Les délimiteurs sont retirés au
 * rendu, le texte nu reste lisible tel quel.
 */
export function renderConjHintLine(line: string): ReactNode {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_|\^[^^]+\^|~[^~]+~)/);
  if (parts.length === 1) return line;
  // Le groupe capturant de `split` place chaque balise à un indice impair.
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const inner = part.slice(1, -1);
    switch (part[0]) {
      case '*':
        return <b key={i} className="conj-hint-mark">{inner}</b>;
      case '_':
        return <b key={i} className="conj-hint-stem">{inner}</b>;
      case '^':
        return <b key={i} className="conj-hint-mark is-lit">{inner}</b>;
      default: // '~'
        return <s key={i} className="conj-hint-struck">{inner}</s>;
    }
  });
}

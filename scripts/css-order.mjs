// Les feuilles CSS de src/, dans l'ordre où la cascade les voit.
//
// Source unique, partagée par scripts/dev.mjs (un <link> par feuille) et par
// scripts/build.mjs (dist/styles.css). Chacun triait autrefois à sa façon,
// `localeCompare` au build et code units en dev, et ils ne s'accordaient que
// parce que tous les noms sous components/ et screens/ commencent par une
// majuscule : un `src/Theme.css` serait sorti dernier au build et deuxième en
// dev, et la cascade aurait différé sans un avertissement.

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Chemins des `.css` de `srcDir`, relatifs à ce dossier et séparés par `/`,
 * hors dossiers `__tests__` (que le build ne publie pas, cf. `isTestFile`).
 *
 * Triés par code units (le `sort()` par défaut : majuscules, puis `_`, puis
 * minuscules), jamais par `localeCompare`, dont la collation dépend de l'ICU
 * et de la locale, ignore la casse au premier niveau et range la ponctuation
 * avant les lettres.
 *
 * Comme le tri porte sur le chemin, `index.css` n'est pas en tête (c'est
 * `App.css`), et les feuilles des composants passent avant celles des écrans.
 * Cet ordre compte : à spécificité égale, la dernière règle gagne (cf. le
 * `:where()` de ParentDashboard.css). Les `var(--*)`, eux, se résolvent à
 * l'utilisation, pas au parse de leur définition.
 */
export async function listSrcCssFiles(srcDir) {
  // withFileTypes : ni dossier dans la liste, ni lien symbolique suivi, comme
  // la marche de build.mjs (et pas de stat par entrée).
  return (await fs.readdir(srcDir, { recursive: true, withFileTypes: true }))
    .filter((e) => !e.isDirectory() && e.name.endsWith('.css'))
    .map((e) => path.relative(srcDir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .filter((rel) => !rel.split('/').includes('__tests__'))
    .sort()
}

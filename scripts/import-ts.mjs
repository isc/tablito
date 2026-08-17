import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Importe un module TypeScript de `src/` depuis un script Node, sans build.
 *
 * Node ne sait pas charger du .ts : on le transforme à la volée avec esbuild
 * (transformation FICHIER À FICHIER, pas de bundle) et on importe le résultat en
 * data: URL. Les modules ainsi chargés ne doivent donc avoir que des imports
 * `type` — sinon la résolution de l'import échoue depuis la data: URL, et le
 * script casse bruyamment (c'est le cas de `conjugationFacts.ts` et de
 * `letterNames.ts`, tous deux sans dépendance runtime).
 *
 * Sert à ne jamais recopier des données rédigées à la main dans un script : une
 * copie divergerait en silence.
 */
export async function importTs(relPath) {
  const source = await readFile(join(ROOT, relPath), 'utf8')
  const { code } = await esbuild.transform(source, { loader: 'ts', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

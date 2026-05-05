// Vendore Preact dans `vendor/preact/` en COPIANT les fichiers ESM publiés
// sur npm tels quels. Pas de bundling, pas de transformation. C'est
// l'équivalent de `bin/importmap pin --download` côté Rails.
//
// À relancer manuellement au bump de Preact.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'vendor/preact')
const SRC = path.join(ROOT, 'node_modules/preact')

const files = {
  'preact.module.js':      'dist/preact.module.js',
  'hooks.module.js':       'hooks/dist/hooks.module.js',
  'compat.module.js':      'compat/dist/compat.module.js',
  'jsx-runtime.module.js': 'jsx-runtime/dist/jsxRuntime.module.js',
  'compat-client.mjs':     'compat/client.mjs',
}

await fs.mkdir(OUT, { recursive: true })
for (const [out, src] of Object.entries(files)) {
  await fs.copyFile(path.join(SRC, src), path.join(OUT, out))
}
console.log(`Vendored Preact (${Object.keys(files).length} files) into ${OUT}`)

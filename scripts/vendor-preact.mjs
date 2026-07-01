// Vendore les dépendances runtime (Preact dans `vendor/preact/`, lean-qr dans
// `vendor/lean-qr/`) en COPIANT les fichiers ESM publiés sur npm tels quels.
// Pas de bundling, pas de transformation. C'est l'équivalent de
// `bin/importmap pin --download` côté Rails.
//
// À relancer manuellement au bump de Preact ou de lean-qr.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Par package : { dossier de sortie sous vendor/, fichiers {out: src} }.
const packages = {
  preact: {
    out: 'vendor/preact',
    files: {
      'preact.module.js':      'dist/preact.module.js',
      'hooks.module.js':       'hooks/dist/hooks.module.js',
      'compat.module.js':      'compat/dist/compat.module.js',
      'jsx-runtime.module.js': 'jsx-runtime/dist/jsxRuntime.module.js',
      'compat-client.mjs':     'compat/client.mjs',
    },
  },
  // Générateur de QR code (lien de transfert entre appareils) — chargé en
  // import() dynamique par ParentDashboard, jamais dans le graphe initial.
  'lean-qr': {
    out: 'vendor/lean-qr',
    files: { 'index.mjs': 'index.mjs' },
  },
  // Lecteur de QR code (scan in-app du transfert, côté nouvel appareil) —
  // chargé en import() dynamique par WelcomeScreen. Le worker est résolu par
  // la lib via un import() relatif : les deux fichiers doivent rester côte à
  // côte.
  'qr-scanner': {
    out: 'vendor/qr-scanner',
    files: {
      'qr-scanner.min.js':        'qr-scanner.min.js',
      'qr-scanner-worker.min.js': 'qr-scanner-worker.min.js',
    },
  },
}

// On ne vendore PAS les `.map` (sources d'origine non publiées) : on retire
// donc l'annotation `//# sourceMappingURL=…` sinon le navigateur tente de
// charger des fichiers absents → 404 bruyants en console (DevTools).
const stripSourceMap = (code) =>
  code.replace(/\n?\/\/# sourceMappingURL=.*\.map\s*$/, '\n')

for (const [name, { out, files }] of Object.entries(packages)) {
  const OUT = path.join(ROOT, out)
  const SRC = path.join(ROOT, 'node_modules', name)
  await fs.mkdir(OUT, { recursive: true })
  for (const [dst, src] of Object.entries(files)) {
    const code = await fs.readFile(path.join(SRC, src), 'utf8')
    await fs.writeFile(path.join(OUT, dst), stripSourceMap(code))
  }
  console.log(`Vendored ${name} (${Object.keys(files).length} files) into ${OUT}`)
}

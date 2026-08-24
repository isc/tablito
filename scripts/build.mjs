// Build de prod : produit un dossier `dist/` 100% statique déployable
// tel quel sur GitHub Pages (ou n'importe quel CDN).
//
//   npm run build                         → dist/ (BASE=/)
//   BASE=/ npm run build        → dist/ pour sous-chemin
//
// Pas de bundling JS : chaque .ts/.tsx devient un .js indépendant. Les
// imports relatifs sont réécrits pour pointer vers les .js générés.
//
// CSS : tous les .css sources sont concaténés en un seul `dist/styles.css`
// chargé via un unique <link> dans index.html. Le split par composant est
// purement une convention d'auteur (lisibilité) ; le browser n'a aucune
// raison de recevoir 30 requêtes là où 1 suffit.

import crypto from 'node:crypto'
import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAZY_GROUPS, STANDALONE_DOCS, classify } from './cache-config.mjs'

const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC      = path.join(ROOT, 'src')
const PUBLIC   = path.join(ROOT, 'public')
const VENDOR   = path.join(ROOT, 'vendor')
const TEMPLATE = path.join(ROOT, 'index.html')
const SW_SRC   = path.join(ROOT, 'scripts/sw.js')
const REG_SRC  = path.join(ROOT, 'scripts/pwa-register.js')
const OUT      = path.join(ROOT, 'dist')

const BASE    = process.env.BASE ?? '/'
const VERSION = process.env.VERSION ?? new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')

const ENV_DEFINE = {
  'import.meta.env.BASE_URL':                      JSON.stringify(BASE),
  'import.meta.env.MODE':                          '"production"',
  'import.meta.env.DEV':                           'false',
  'import.meta.env.PROD':                          'true',
  'import.meta.env.VITE_APP_VERSION':              JSON.stringify(VERSION),
  'import.meta.env.VITE_BASE_PATH':                JSON.stringify(BASE),
  // VITE_SUPABASE_* viennent de .env via `node --env-file-if-exists=.env`
  // dans package.json. Sans valeur → strings vides → feedbackEnabled retombe
  // sur false au runtime, sans crash (cas d'un contributeur sans config).
  'import.meta.env.VITE_SUPABASE_URL':             JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
  // Clé VAPID publique (Web Push). Comme ci-dessus : vient de .env, vide → push
  // désactivé au runtime (pushConfigured=false), sans crash.
  'import.meta.env.VITE_VAPID_PUBLIC_KEY':         JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY ?? ''),
}

const SRC_EXTS = ['.tsx', '.ts', '.jsx', '.js']

async function exists(p) { try { await fs.access(p); return true } catch { return false } }
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }) }
async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p); else yield p
  }
}
async function copyTree(src, dst) {
  if (!await exists(src)) return
  await ensureDir(dst)
  for await (const file of walk(src)) {
    const out = path.join(dst, path.relative(src, file))
    await ensureDir(path.dirname(out))
    await fs.copyFile(file, out)
  }
}

// Résout un import relatif (ex `./components/Foo`) en chemin de sortie
// (`./components/Foo.js`). Gère extensions implicites et `index.*`.
async function resolveImport(importPath, fromFile) {
  if (!importPath.startsWith('.')) return importPath
  const fromDir = path.dirname(fromFile)
  const target = path.resolve(fromDir, importPath)
  const ext = path.extname(target)

  if (['.js', '.mjs', '.json'].includes(ext)) return importPath
  if (SRC_EXTS.includes(ext)) return importPath.replace(new RegExp(ext.replace('.', '\\.') + '$'), '.js')

  for (const e of SRC_EXTS) if (await exists(target + e)) return importPath + '.js'
  for (const e of SRC_EXTS) if (await exists(path.join(target, 'index' + e))) return importPath + '/index.js'
  return importPath
}

async function rewriteImports(code, sourceFile) {
  // Capture les imports relatifs : `from "..."`, `import "..."` (statiques),
  // ET `import("...")` (dynamiques, p.ex. via React.lazy → indispensable
  // pour le code-splitting des écrans).
  // L'ordre des alternatives est important : `import\s*\(\s*` doit
  // précéder `import\s*` pour matcher la forme dynamique en premier.
  const re = /(from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g
  const matches = [...code.matchAll(re)]
  for (const m of matches) {
    const resolved = await resolveImport(m[2], sourceFile)
    if (resolved !== m[2]) code = code.replace(m[0], `${m[1]}"${resolved}"`)
  }
  return code
}

console.log(`Building into ${OUT} (BASE=${BASE}, VERSION=${VERSION})`)
await fs.rm(OUT, { recursive: true, force: true })
await ensureDir(OUT)

// Les tests vivent dans src/ mais n'ont rien à faire en ligne : sans ce filtre,
// leurs ~40 bundles partent dans dist/ ET dans le précache du SW, soit ~150 Ko
// téléchargés à chaque install/mise à jour pour du code que personne n'exécute.
const isTestFile = (rel) =>
  rel.split(path.sep).includes('__tests__') || /\.test\.[jt]sx?$/.test(rel)

// Un .d.ts ne décrit que des types : le transformer produit un .js vide, copié
// dans dist/ et précaché pour rien (c'était le cas de src/env.d.ts).
const isDeclaration = (rel) => rel.endsWith('.d.ts')

// 1) Transforme/copie src/. Les .css sources sont collectés pour
// concaténation en bundle unique (étape 1.5).
const cssFiles = []
for await (const file of walk(SRC)) {
  const rel = path.relative(SRC, file)
  if (isTestFile(rel) || isDeclaration(rel)) continue
  const ext = path.extname(file)
  const outDir = path.join(OUT, 'src', path.dirname(rel))

  if (['.ts', '.tsx', '.jsx'].includes(ext)) {
    await ensureDir(outDir)
    const source = await fs.readFile(file, 'utf8')
    const outName = path.basename(rel, ext) + '.js'
    const result = await esbuild.transform(source, {
      loader: ext.slice(1),
      format: 'esm',
      target: 'es2022',
      jsx: 'automatic',
      jsxImportSource: 'preact',
      define: ENV_DEFINE,
      sourcefile: rel,
      minify: true,
      sourcemap: 'external',
    })
    const code = await rewriteImports(result.code, file)
    // Lien vers la source map à côté (esbuild ne l'ajoute pas en mode external).
    const codeWithMap = code + `\n//# sourceMappingURL=${outName}.map\n`
    await fs.writeFile(path.join(outDir, outName), codeWithMap)
    await fs.writeFile(path.join(outDir, outName + '.map'), result.map)
  } else if (ext === '.css') {
    cssFiles.push({ rel, abs: file })
  } else {
    await ensureDir(outDir)
    await fs.copyFile(file, path.join(outDir, path.basename(rel)))
  }
}

// 1.5) Concat tous les CSS sources en un seul dist/styles.css.
// Économise 30 requêtes HTTP au cold load. L'ordre est alphabétique
// pour la reproductibilité, donc index.css n'est pas en tête (c'est
// `App.css` qui sort en premier). Sans impact pratique : les classnames
// sont préfixés par composant (`.session-*`, `.parent-*`…) donc pas de
// collision de spécificité, et les `var(--*)` se résolvent à
// l'utilisation, pas au parse de leur définition.
cssFiles.sort((a, b) => a.rel.localeCompare(b.rel))
const concatenated = (await Promise.all(
  cssFiles.map(async ({ rel, abs }) => `/* ===== ${rel} ===== */\n${await fs.readFile(abs, 'utf8')}`),
)).join('\n')
await fs.writeFile(path.join(OUT, 'styles.css'), concatenated)

// 2) Vendor + public
await copyTree(VENDOR, path.join(OUT, 'vendor'))
await copyTree(PUBLIC, OUT)

// 3) index.html avec import map, chemins absolus adaptés à BASE, et
// <link> unique vers le bundle styles.css concaténé en 1.5.
let html = await fs.readFile(TEMPLATE, 'utf8')
const stylesLink = `    <link rel="stylesheet" href="${BASE}styles.css" />`
html = html
  .replace(/\/vendor\//g, BASE + 'vendor/')
  .replace(/\/scripts\/pwa-register-noop\.js/g, BASE + 'pwa-register.js')
  .replace(/(["'])\/(icons|splash|fonts)\//g, `$1${BASE}$2/`)
  .replace(/\/src\/main\.tsx/g, BASE + 'src/main.js')
  .replace(/(<\/head>)/, `${stylesLink}\n  $1`)
await fs.writeFile(path.join(OUT, 'index.html'), html)

// 3.5) Réécrit les URLs dans dist/fonts/fonts.css (`url("/fonts/...")`)
// pour respecter BASE — sinon en prod (BASE=/) les @font-face
// pointent sur /fonts/... et 404 sur GitHub Pages.
const fontsCssPath = path.join(OUT, 'fonts', 'fonts.css')
if (BASE !== '/') {
  const fontsCss = await fs.readFile(fontsCssPath, 'utf8')
  await fs.writeFile(fontsCssPath, fontsCss.replace(/(["'])\/fonts\//g, `$1${BASE}fonts/`))
}

// 4) Liste les assets pour le SW :
//    - shell : tout ce qui est nécessaire pour le 1er render (HTML, JS, CSS,
//      vendor, icônes, manifest). Précaché à l'install.
//    - lazy : cachés à la demande lors de la 1re utilisation, pour éviter un
//      install lourd de 80 Mo. Qui va où : `classify`, dans cache-config.mjs.
const BASE_PREFIX = BASE.replace(/\/$/, '')
const shellAssets = []
let shellBytes = 0
const lazyFiles = Object.fromEntries(Object.keys(LAZY_GROUPS).map((g) => [g, []])) // groupe -> [{ rel, file }], pour hasher le contenu
for await (const f of walk(OUT)) {
  const rel = '/' + path.relative(OUT, f).split(path.sep).join('/')
  const kind = classify(rel)
  if (kind === 'skip') continue
  if (kind !== 'shell') {
    lazyFiles[kind.slice('lazy:'.length)].push({ rel, file: f })
    continue
  }
  shellAssets.push(BASE_PREFIX + rel)
  shellBytes += (await fs.stat(f)).size
}

// Version de chaque groupe lazy = hash de son CONTENU, pas du build. Le cache
// shell, lui, reste versionné par build : son contenu doit être remplacé à
// chaque déploiement. Mettre les deux dans le même cache faisait jeter les
// ~13 Mo d'images mystère et les ~55 Mo de MP3 à chaque mise en ligne, alors
// que ces fichiers n'avaient pas bougé (feedback du 11/08/2026 : « les images
// mystère sont retéléchargées à chaque redémarrage »).
const lazyVersions = {}
for (const [group, files] of Object.entries(lazyFiles)) {
  const h = crypto.createHash('sha1')
  for (const { rel, file } of files.sort((a, b) => (a.rel < b.rel ? -1 : 1))) {
    h.update(rel)
    h.update(await fs.readFile(file))
  }
  lazyVersions[group] = h.digest('hex').slice(0, 12)
}

// 5) SW + pwa-register
let sw = await fs.readFile(SW_SRC, 'utf8')
sw = sw
  .replaceAll('__VERSION__', JSON.stringify(VERSION))
  .replaceAll('__BASE__', JSON.stringify(BASE))
  .replaceAll('__ASSETS__', JSON.stringify(shellAssets, null, 2))
  .replaceAll('__LAZY_GROUPS__', JSON.stringify(
    Object.fromEntries(Object.entries(LAZY_GROUPS)
      .map(([g, prefixes]) => [g, prefixes.map((p) => BASE_PREFIX + p)])),
  ))
  .replaceAll('__LAZY_VERSIONS__', JSON.stringify(lazyVersions))
  .replaceAll('__STANDALONE_DOCS__', JSON.stringify(STANDALONE_DOCS))
await fs.writeFile(path.join(OUT, 'sw.js'), sw)

let reg = await fs.readFile(REG_SRC, 'utf8')
reg = reg.replaceAll('__SW_PATH__', JSON.stringify(BASE + 'sw.js'))
await fs.writeFile(path.join(OUT, 'pwa-register.js'), reg)

const totalKB = Math.round((await du(OUT)) / 1024)
// Somme des assets réellement précachés, accumulée pendant la marche : le
// chiffre annoncé ne peut plus diverger de ce que le SW télécharge.
const precacheKB = Math.round(shellBytes / 1024)
console.log(`Build OK : ${shellAssets.length} assets précachés, ${precacheKB} KB / total ${totalKB} KB`)

async function du(dir, filter = () => true) {
  let total = 0
  for await (const f of walk(dir)) if (filter(f)) total += (await fs.stat(f)).size
  return total
}

// Build de prod : produit un dossier `dist/` 100% statique déployable
// tel quel sur GitHub Pages (ou n'importe quel CDN).
//
//   npm run build                         → dist/ (BASE=/)
//   BASE=/multiplix/ npm run build        → dist/ pour sous-chemin
//
// Pas de bundling : chaque .ts/.tsx devient un .js indépendant. Les
// imports relatifs sont réécrits pour pointer vers les .js générés. Les
// imports CSS deviennent `./X.css.js` (shim qui injecte un <link>) avec
// le vrai .css copié à côté.

import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
  // Pour le moment l'envoi de feedback n'est pas branché côté nobuild ; les
  // valeurs vides désactivent feedbackEnabled au runtime.
  'import.meta.env.VITE_SUPABASE_URL':             JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
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

  if (ext === '.css') return importPath + '.js'
  if (['.js', '.mjs', '.json'].includes(ext)) return importPath
  if (SRC_EXTS.includes(ext)) return importPath.replace(new RegExp(ext.replace('.', '\\.') + '$'), '.js')

  for (const e of SRC_EXTS) if (await exists(target + e)) return importPath + '.js'
  for (const e of SRC_EXTS) if (await exists(path.join(target, 'index' + e))) return importPath + '/index.js'
  return importPath
}

const cssShim = (basename) =>
  `const l=document.createElement('link');l.rel='stylesheet';l.href=new URL(${JSON.stringify('./' + basename)},import.meta.url).href;document.head.appendChild(l);\n`

async function rewriteImports(code, sourceFile) {
  // Capture les `from "..."` et `import "..."` (statiques) dont le path est relatif.
  const re = /(from\s*|import\s*)["'](\.[^"']+)["']/g
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

// 1) Transforme/copie src/. On collecte aussi tous les .css pour les
// pré-charger via <link> dans l'index.html (évite le FOUC : sinon chaque
// import CSS attend que son shim JS s'exécute).
const cssLinks = []
for await (const file of walk(SRC)) {
  const rel = path.relative(SRC, file)
  const ext = path.extname(file)
  const outDir = path.join(OUT, 'src', path.dirname(rel))
  await ensureDir(outDir)

  if (['.ts', '.tsx', '.jsx'].includes(ext)) {
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
    const base = path.basename(rel)
    await fs.copyFile(file, path.join(outDir, base))
    // Shim no-op : le CSS est déjà chargé via <link> dans index.html. Un
    // import './X.css' devient `import './X.css.js'` (vide), inoffensif.
    await fs.writeFile(path.join(outDir, base + '.js'), '')
    cssLinks.push(['src', ...rel.split(path.sep)].join('/'))
  } else {
    await fs.copyFile(file, path.join(outDir, path.basename(rel)))
  }
}

// 2) Vendor + public
await copyTree(VENDOR, path.join(OUT, 'vendor'))
await copyTree(PUBLIC, OUT)

// 3) index.html avec import map, chemins absolus adaptés à BASE, et
// <link> pour tous les CSS (évite le FOUC).
let html = await fs.readFile(TEMPLATE, 'utf8')
const linkTags = cssLinks
  .sort()
  .map((p) => `    <link rel="stylesheet" href="${BASE}${p}" />`)
  .join('\n')
html = html
  .replace(/\/vendor\//g, BASE + 'vendor/')
  .replace(/\/scripts\/pwa-register-noop\.js/g, BASE + 'pwa-register.js')
  .replace(/(["'])\/(icons|splash)\//g, `$1${BASE}$2/`)
  .replace(/\/src\/main\.tsx/g, BASE + 'src/main.js')
  .replace(/(<\/head>)/, `${linkTags}\n  $1`)
await fs.writeFile(path.join(OUT, 'index.html'), html)

// 4) Liste les assets pour le SW :
//    - shell : tout ce qui est nécessaire pour le 1er render (HTML, JS, CSS,
//      vendor, icônes, manifest). Précaché à l'install.
//    - lazy : audio + grosses images (mystery, splash). Caché à la demande
//      lors de la 1re utilisation, pour éviter un install lourd de 10 Mo.
const shellAssets = []
for await (const f of walk(OUT)) {
  const rel = '/' + path.relative(OUT, f).split(path.sep).join('/')
  if (rel.endsWith('/sw.js')) continue
  if (rel.endsWith('.map')) continue
  if (rel.startsWith('/audio/')) continue
  if (rel.startsWith('/mystery/')) continue
  if (rel.startsWith('/splash/')) continue
  shellAssets.push(BASE.replace(/\/$/, '') + rel)
}

// 5) SW + pwa-register
let sw = await fs.readFile(SW_SRC, 'utf8')
sw = sw
  .replaceAll('__VERSION__', JSON.stringify(VERSION))
  .replaceAll('__BASE__', JSON.stringify(BASE))
  .replaceAll('__ASSETS__', JSON.stringify(shellAssets, null, 2))
await fs.writeFile(path.join(OUT, 'sw.js'), sw)

let reg = await fs.readFile(REG_SRC, 'utf8')
reg = reg.replaceAll('__SW_PATH__', JSON.stringify(BASE + 'sw.js'))
await fs.writeFile(path.join(OUT, 'pwa-register.js'), reg)

const totalKB = Math.round((await du(OUT)) / 1024)
const shellKB = Math.round((await du(OUT, (f) => {
  const rel = path.relative(OUT, f)
  return !rel.startsWith('audio') && !rel.startsWith('mystery') && !rel.startsWith('splash') && !rel.endsWith('.map')
})) / 1024)
console.log(`Build OK : ${shellAssets.length} shell assets (precache), shell ${shellKB} KB / total ${totalKB} KB`)

async function du(dir, filter = () => true) {
  let total = 0
  for await (const f of walk(dir)) if (filter(f)) total += (await fs.stat(f)).size
  return total
}

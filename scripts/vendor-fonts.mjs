// Self-host des fontes Google utilisées par Multiplix.
//
// Pourquoi : Google Fonts est cross-origin → le SW ne peut pas les
// précacher (cf. sw.js:36). Chaque cold launch online tape Google CDN
// pour la CSS + les .woff2. Offline, les fontes ne chargent pas du tout
// → fallback système → FOUT visible.
//
// Stratégie : on télécharge le CSS Google avec un UA Chrome moderne (woff2),
// on filtre au subset `latin` (les enfants français n'ont pas besoin de
// vietnamien/cyrillique/grec), on télécharge chaque .woff2 référencé, et on
// réécrit la CSS pour pointer en local (/fonts/...).
//
// Les fichiers checked-in vont dans public/fonts/. Ils sont précachés par
// le SW au build (cf. scripts/build.mjs § shell assets).
//
// Idempotent : ne re-télécharge un .woff2 que s'il manque. Pour forcer
// un rafraîchissement (mise à jour upstream), supprimer public/fonts/ et
// relancer.

import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'fonts')
const INDEX_HTML = path.join(ROOT, 'index.html')

// Les préloads `<link rel="preload">` dans index.html sont identifiés par
// leurs attributs `data-family` et `data-style`. Ce script les réécrit si
// Google republie les fontes (slugs upstream changent → href deviendraient
// 404). Pas de constante en dur ici : on parse les `data-*` à l'exécution.

// Même URL exacte que celle utilisée actuellement dans index.html.
const CSS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&' +
  'family=Nunito:wght@400;500;600;700;800&' +
  'family=JetBrains+Mono:wght@500&' +
  'display=swap'

// UA Chrome moderne pour récupérer le format woff2.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

async function fetchBytes(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

await fs.mkdir(OUT, { recursive: true })

console.log('[fonts] fetching Google Fonts CSS…')
const css = await fetchText(CSS_URL)

// Le CSS Google a la forme :
//   /* latin */
//   @font-face { font-family: 'X'; ...; src: url(...) format('woff2'); ... }
//   /* latin-ext */
//   @font-face { ... }
// On split par les commentaires de subset, on garde seulement les blocs
// précédés du commentaire `/* latin */`.
const blocks = []
const re = /\/\*\s*([^*]+?)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g
let m
while ((m = re.exec(css)) !== null) {
  const subset = m[1].trim()
  if (subset === 'latin') blocks.push(m[2])
}
if (blocks.length === 0) throw new Error('No latin @font-face blocks found in CSS')
console.log(`[fonts] kept ${blocks.length} latin @font-face blocks`)

// Télécharge chaque woff2 unique (Google sert souvent le même fichier
// variable pour plusieurs poids — on dédup par URL distante) et réécrit
// les URL en local.
const urlToSlug = new Map()
const localBlocks = []
for (const block of blocks) {
  const urlMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)
  if (!urlMatch) {
    console.warn('[fonts] skipping block without woff2 URL:', block.slice(0, 80))
    continue
  }
  const remoteUrl = urlMatch[1]

  let slug = urlToSlug.get(remoteUrl)
  if (!slug) {
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1] || 'unknown'
    const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || 'normal'
    // Hash court de l'URL pour rester stable même si la palette de poids
    // change : un seul fichier par font binaire upstream.
    const hash = remoteUrl.split('/').pop().replace(/\.woff2$/, '').slice(-8)
    slug = `${family.toLowerCase().replace(/\s+/g, '-')}-${style}-${hash}.woff2`
    urlToSlug.set(remoteUrl, slug)

    const localPath = path.join(OUT, slug)
    if (!existsSync(localPath)) {
      const bytes = await fetchBytes(remoteUrl)
      await fs.writeFile(localPath, bytes)
      console.log(`[fonts] ↓ ${slug}  (${(bytes.length / 1024).toFixed(1)} KB)`)
    } else {
      console.log(`[fonts] = ${slug}  (already cached)`)
    }
  }

  // Quotes autour de l'URL pour que le rewrite BASE de scripts/build.mjs:153
  // (qui matche `(["'])\/(icons|splash|fonts)\/`) attrape l'URL en prod.
  // Sans les guillemets, l'URL reste en `/fonts/...` et 404 sur GitHub Pages.
  localBlocks.push(block.replace(remoteUrl, `"/fonts/${slug}"`))
}

// Écrit la CSS finale.
const header =
  '/* Self-hosted Google Fonts (latin subset only).\n' +
  '   Régénéré par scripts/vendor-fonts.mjs depuis ' + CSS_URL + '\n' +
  '   Licence : Open Font License (chaque famille — voir les fichiers d\'origine). */\n\n'
await fs.writeFile(path.join(OUT, 'fonts.css'), header + localBlocks.join('\n\n') + '\n')
console.log(`[fonts] wrote ${path.relative(ROOT, path.join(OUT, 'fonts.css'))}`)

// Met à jour le href de chaque <link rel="preload"> dans index.html avec
// le slug courant. Sans ça, si Google republie une font et que les slugs
// upstream changent, le preload pointerait sur un fichier orphelin → 404
// silencieux + fonte critique non préchargée.
const html = await fs.readFile(INDEX_HTML, 'utf8')
const preloadRe = /<link\s+rel="preload"\s+as="font"[^>]*?data-family="([^"]+)"[^>]*?data-style="([^"]+)"[^>]*?href="\/fonts\/[^"]+"[^>]*?\/?>/g
const matches = [...html.matchAll(preloadRe)]
if (matches.length === 0) {
  throw new Error('[fonts] no <link rel="preload" data-family="..." data-style="..."> in index.html — vendor-fonts can no longer maintain hrefs')
}
let updated = html
for (const m of matches) {
  const [tag, family, style] = m
  const block = blocks.find(
    (b) =>
      new RegExp(`font-family:\\s*'${family}'`).test(b) &&
      new RegExp(`font-style:\\s*${style}`).test(b),
  )
  if (!block) {
    throw new Error(`[fonts] no ${family} ${style} block found — preload would 404`)
  }
  const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)[1]
  const slug = urlToSlug.get(url)
  const fixedTag = tag.replace(/href="\/fonts\/[^"]+"/, `href="/fonts/${slug}"`)
  if (fixedTag !== tag) {
    updated = updated.replace(tag, fixedTag)
    console.log(`[fonts] updated preload ${family} ${style} href → /fonts/${slug}`)
  } else {
    console.log(`[fonts] preload ${family} ${style} already on /fonts/${slug}`)
  }
}
if (updated !== html) {
  await fs.writeFile(INDEX_HTML, updated)
}

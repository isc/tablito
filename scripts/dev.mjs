// Dev server : esbuild en pur transformer (pas de bundling), import
// maps pour les bare specifiers, ESM natif côté navigateur.
//
//   npm run dev   →   http://localhost:5174/
//
// Ce qui est géré :
//  - .ts/.tsx/.jsx → transformés à la volée (esbuild.transform, format ESM)
//  - imports CSS (`import './Foo.css'`) → réécrits vers une URL `?as=link`
//    qui renvoie un petit bout de JS injectant un <link rel="stylesheet">
//  - imports sans extension → résolus en .tsx/.ts/.jsx/.js puis index.*
//  - import.meta.env.* → remplacés via esbuild `define`
//  - virtual:pwa-register → no-op via import map (pas de SW en dev)

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 5174)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
}

// Substitutions pour `import.meta.env.X` côté POC. Les secrets restent
// undefined (Supabase est désactivé sans clé, c'est le comportement attendu).
const ENV_DEFINE = {
  'import.meta.env.BASE_URL':                      '"/"',
  'import.meta.env.MODE':                          '"development"',
  'import.meta.env.DEV':                           'true',
  'import.meta.env.PROD':                          'false',
  'import.meta.env.VITE_APP_VERSION':              '"nobuild-poc"',
  'import.meta.env.VITE_BASE_PATH':                '"/"',
  // Strings vides en dev : `feedbackEnabled` retombe sur false sans crash.
  // À surcharger via .env.local + un mécanisme adhoc le jour où on reproduit
  // le feedback en local.
  'import.meta.env.VITE_SUPABASE_URL':             '""',
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""',
}

const TRANSFORM_EXT = new Set(['.ts', '.tsx', '.jsx'])

async function tryFile(p) {
  try { const s = await fs.stat(p); if (s.isFile()) return p } catch {}
  return null
}

// Résolution à la Node : direct, puis extensions, puis index.*. Cherche dans
// la racine du projet puis dans `public/`.
async function resolveUrl(pathname) {
  const cleaned = pathname.replace(/^\/+/, '')
  const roots = [path.join(ROOT, cleaned), path.join(ROOT, 'public', cleaned)]

  for (const c of roots) {
    const f = await tryFile(c)
    if (f) return f
  }
  if (path.extname(cleaned)) return null

  const exts = ['.tsx', '.ts', '.jsx', '.js']
  for (const r of roots) {
    for (const e of exts) {
      const f = await tryFile(r + e)
      if (f) return f
    }
    for (const e of exts) {
      const f = await tryFile(path.join(r, 'index' + e))
      if (f) return f
    }
  }
  return null
}

// Liste tous les .css de src/ pour les pré-charger via <link> dans
// l'index.html — évite le FOUC (sinon les CSS importés depuis JS arrivent
// après le 1er render).
async function listSrcCssFiles() {
  const out = []
  async function walk(dir, prefix) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      const rel = prefix ? prefix + '/' + e.name : e.name
      if (e.isDirectory()) await walk(p, rel)
      else if (e.name.endsWith('.css')) out.push('/src/' + rel)
    }
  }
  await walk(path.join(ROOT, 'src'), '')
  return out.sort()
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`)
    let pathname = decodeURIComponent(u.pathname)
    if (pathname === '/') pathname = '/index.html'

    // Sert l'index.html avec les <link> CSS pré-injectés.
    if (pathname === '/index.html') {
      let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8')
      const cssFiles = await listSrcCssFiles()
      const linkTags = cssFiles.map((p) => `    <link rel="stylesheet" href="${p}" />`).join('\n')
      html = html.replace(/(<\/head>)/, `${linkTags}\n  $1`)
      res.writeHead(200, { 'Content-Type': MIME['.html'] })
      return res.end(html)
    }

    // Helper "import './foo.css?as=link'" : renvoie un JS qui injecte un
    // <link>. Inutile maintenant que tous les CSS sont pré-chargés via
    // index.html, mais on le garde pour ne pas avoir à modifier le
    // transform (qui rewrites les imports CSS vers ce shim).
    if (pathname.endsWith('.css') && u.searchParams.get('as') === 'link') {
      // No-op : le CSS est déjà chargé.
      res.writeHead(200, { 'Content-Type': MIME['.js'] })
      return res.end('')
    }

    const filePath = await resolveUrl(pathname)
    if (!filePath) {
      res.writeHead(404)
      return res.end(`Not found: ${pathname}`)
    }

    const ext = path.extname(filePath)

    if (TRANSFORM_EXT.has(ext)) {
      const source = await fs.readFile(filePath, 'utf8')
      const result = await esbuild.transform(source, {
        loader: ext.slice(1),
        format: 'esm',
        target: 'es2022',
        jsx: 'automatic',
        // Cible Preact : esbuild émet `import { jsx } from "preact/jsx-runtime"`
        // au lieu de `react/jsx-runtime`. L'import map fait le reste.
        jsxImportSource: 'preact',
        sourcemap: 'inline',
        sourcefile: pathname,
        define: ENV_DEFINE,
      })
      // Réécriture des imports CSS pour passer par le helper d'injection.
      const code = result.code
        .replace(/from\s*["']([^"']+\.css)["']/g, (_, p) => `from "${p}?as=link"`)
        .replace(/import\s*["']([^"']+\.css)["']/g, (_, p) => `import "${p}?as=link"`)
      res.writeHead(200, { 'Content-Type': MIME['.js'] })
      return res.end(code)
    }

    const buf = await fs.readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(buf)
  } catch (e) {
    console.error('[nobuild]', req.url, e)
    res.writeHead(500)
    res.end(String(e))
  }
})

server.listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}/`)
})

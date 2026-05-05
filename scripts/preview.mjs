// Sert dist/ pour preview locale du build de prod.
//
//   npm run preview                    →  http://localhost:5175/
//   BASE=/multiplix/ npm run preview   →  http://localhost:5175/multiplix/
//
// Le préfixe BASE est strippé de l'URL avant lookup dans dist/, ce qui
// reproduit le comportement de GitHub Pages servant le repo sous un
// sous-chemin.

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const PORT = Number(process.env.PORT ?? 5175)
const BASE = process.env.BASE ?? '/'

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':  'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp':'image/webp',
  '.woff2':'font/woff2',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, `http://x:${PORT}`).pathname)
  if (BASE !== '/' && !p.startsWith(BASE)) {
    res.writeHead(404); return res.end(`Not under ${BASE}`)
  }
  if (BASE !== '/') p = p.slice(BASE.length - 1)
  if (p === '' || p === '/' || p.endsWith('/')) p += 'index.html'
  try {
    const buf = await fs.readFile(path.join(ROOT, p))
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404); res.end('not found: ' + p)
  }
}).listen(PORT, () => {
  console.log(`Nobuild preview: http://localhost:${PORT}${BASE === '/' ? '/' : BASE}`)
})

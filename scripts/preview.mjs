// Sert dist/ pour preview locale du build de prod.
//
//   npm run preview                    →  http://localhost:5175/
//   BASE=/ npm run preview   →  http://localhost:5175/
//
// Le préfixe BASE est strippé de l'URL avant lookup dans dist/, ce qui
// reproduit le comportement de GitHub Pages servant le repo sous un
// sous-chemin.

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIME } from './mime.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const PORT = Number(process.env.PORT ?? 5175)
const BASE = process.env.BASE ?? '/'

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

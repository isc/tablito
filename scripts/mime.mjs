// Table MIME partagée entre `dev.mjs` (dev server) et `preview.mjs` (preview
// du build). `.map` n'est servi que par preview (sourcemaps externes du
// build), pas par dev (sourcemaps inline) — l'entrée est inoffensive là-bas.
export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.map':  'application/json',
  '.webmanifest': 'application/manifest+json',
}

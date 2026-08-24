// Ce que le Service Worker fait de chaque fichier de `dist/`.
//
// Source unique, partagée par scripts/build.mjs (qui construit la liste de
// précache et injecte ces tables dans le SW) et par scripts/sw-cache.test.mjs.
// Les mêmes chemins décidaient autrefois de deux choses dans deux fichiers ;
// ils divergeaient en silence.

// Assets hors shell : trop lourds pour un précache à l'install, donc cachés à la
// demande par le SW. Un groupe = un cache SW à part, versionné par le contenu du
// groupe : régénérer les MP3 n'invalide pas les images mystère, et inversement.
export const LAZY_GROUPS = {
  audio: ['/audio/'],
  media: [
    '/mystery/',
    '/splash/',
    '/video/', // démo de la landing : la PWA installée saute la landing (skip-static-landing)
    // ⚠ Le scanner de QR (~58 Ko, utilisé au plus une fois par appareil) a le
    // même profil que le générateur du groupe `qrgen`, mais le sortir d'ici
    // changerait le hash de `media` : ~22 Mo re-téléchargés par tout le monde
    // pour déplacer 58 Ko. À déplacer le jour où `media` change pour une autre
    // raison — pas avant.
    '/vendor/qr-scanner/',
    '/img/hero-poster', // idem : poster de la démo, hors shell de l'app
  ],
  // Dictionnaire de prononciation du mode vocal épelé (specs §15.10) : demandé
  // seulement quand ce mode optionnel est actif, donc jamais précaché. Groupe à
  // part et non `media` : son cycle de vie est le sien (il ne change qu'avec
  // l'inventaire de la conjugaison), et le mêler aux images mystère jetterait
  // ~13 Mo déjà téléchargés à la moindre régénération.
  phonetic: ['/phonetic/'],
  // Générateur de QR du transfert de profil, importé dynamiquement par QrCanvas
  // (jamais lu au 1er render). Cycle de vie propre : il ne bouge qu'au bump de
  // lean-qr. Ne contient pas le scanner, cf. la note dans `media`.
  qrgen: ['/vendor/lean-qr/'],
}

// Documents autonomes : guide, specs, previews de PR. Ils ont leur propre
// index.html, et le SW laisse le navigateur gérer leurs navigations — donc les
// précacher revient à télécharger un fichier que rien ne relira jamais depuis ce
// cache (/specs/index.html pesait 158 Ko, 15 % du précache). Chemins nus :
// testés avec `includes` côté SW, donc valides quelle que soit la BASE.
export const STANDALONE_DOCS = ['/guide/', '/specs/', '/previews/']

// Lus par les crawlers ou par l'hébergeur, jamais par l'app.
const NEVER_FETCHED = ['/og-image.png', '/robots.txt', '/sitemap.xml', '/CNAME']

/**
 * Le destin d'un fichier de `dist/`, désigné par son chemin absolu au site :
 * `'shell'` (précaché à l'install), `'lazy:<groupe>'` (caché à la demande), ou
 * `'skip'` (jamais mis en cache par le SW). Une seule fonction, pour que le
 * poids annoncé au build soit par construction celui du précache.
 */
export function classify(rel) {
  if (rel.endsWith('.map') || rel.endsWith('/sw.js')) return 'skip'
  if (NEVER_FETCHED.includes(rel)) return 'skip'
  if (STANDALONE_DOCS.some((d) => rel.startsWith(d))) return 'skip'
  for (const [group, prefixes] of Object.entries(LAZY_GROUPS)) {
    if (prefixes.some((p) => rel.startsWith(p))) return `lazy:${group}`
  }
  return 'shell'
}

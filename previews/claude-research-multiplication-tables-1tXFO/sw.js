// Service Worker minimal.
//
// Stratégie :
//  - install : precache du shell (HTML, JS, CSS, vendor, icônes — pas
//    les médias lourds qui sont chargés à la demande).
//  - navigation : cache-first sur le shell `index.html` (cold launch
//    instantané, plus aucune attente réseau pour ouvrir l'app). Le
//    fallback réseau couvre uniquement le cas pathologique où le shell
//    n'est pas dans le cache (1re install pas terminée). Les mises à
//    jour passent par le mécanisme SW (browser check de /sw.js + update
//    explicite, cf. pwa-register.js), pas par cette navigation.
//  - autre GET : cache-first puis lazy-cache si succès réseau.
//
// Lifecycle : on ne fait PAS skipWaiting() automatiquement. Un nouveau
// SW reste en `waiting` jusqu'à ce que la page envoie le message
// `SKIP_WAITING` (= elle a décidé que c'était un bon moment, p.ex. on
// est sur la home et pas en pleine séance). Voir scripts/pwa-register.js.
// clients.claim() reste, indispensable pour que le reload qui suit
// skipWaiting passe sous le nouveau SW.
//
// Les marqueurs de version, de base path et de liste d'assets sont
// substitués par scripts/build.mjs.

const CACHE = 'multiplix-' + "20260513190843"
const BASE = "/multiplix/previews/claude-research-multiplication-tables-1tXFO/"
const ASSETS = [
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/favicon.svg",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/fonts/fonts.css",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/icons/apple-touch-icon.png",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/icons/icon-192.png",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/icons/icon-512.png",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/icons/icon.svg",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/icons.svg",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/index.html",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/manifest.webmanifest",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/specs/index.html",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/App.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/badges.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/leitner.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/parseFrenchNumber.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/placement.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/sessionComposer.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/setup.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/strategies.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/streak.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/__tests__/userJourney.test.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/assets/hero.png",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/assets/react.svg",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/assets/vite.svg",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/BackChevron.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/Badge.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/BadgeDetailModal.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/DotGrid.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/ErrorBoundary.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/FeedbackModal.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/FeedbackOverlay.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/FlameIcon.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/Mascot.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/Modal.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/MysteryImage.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/NumPad.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/ParentGate.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/ProgressGrid.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/StrategyHint.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/StreakDetailModal.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/components/VoiceInput.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/env.d.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useConfetti.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useInputMode.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useSound.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useSpeechRecognition.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useTTS.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/hooks/useWakeLock.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/audioContext.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/badges.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/changelog.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/facts.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/feedback.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/install.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/leitner.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/micPreflight.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/parseFrenchNumber.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/placement.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/sessionComposer.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/similarity.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/storage.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/strategies.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/streak.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/lib/utils.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/main.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/BadgesScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/ChangelogScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/HomeScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/ParentDashboard.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/PrivacyScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/ProgressScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/RecapScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/RulesIntroScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/RulesScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/SessionScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/screens/WelcomeScreen.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/src/types.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/styles.css",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/vendor/preact/compat-client.mjs",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/vendor/preact/compat.module.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/vendor/preact/hooks.module.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/vendor/preact/jsx-runtime.module.js",
  "/multiplix/previews/claude-research-multiplication-tables-1tXFO/vendor/preact/preact.module.js"
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  // Navigation : cache-first sur le shell. Sert le `index.html` précaché
  // sans toucher au réseau → cold launch instantané. Les nouvelles versions
  // arrivent par le mécanisme SW (cf. pwa-register.js).
  // Exceptions (équivalent du navigateFallbackDenylist VitePWA) : le guide
  // standalone vit sous son propre index.html, et les previews de PR vivent
  // dans le scope du SW de prod mais ne doivent pas être masquées par le
  // shell de prod. On laisse le browser gérer.
  if (e.request.mode === 'navigate') {
    if (url.pathname.includes('/guide/') || url.pathname.includes('/previews/')) {
      return
    }
    e.respondWith(
      caches.match(BASE + 'index.html').then((cached) => cached || fetch(e.request))
    )
    return
  }

  // Autres GET : cache-first, lazy-cache au passage.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
      }
      return res
    }))
  )
})

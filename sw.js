// Service Worker minimal.
//
// Stratégie :
//  - install : precache du shell (HTML, JS, CSS, vendor, icônes — pas
//    les médias lourds qui sont chargés à la demande), puis skipWaiting()
//    pour activer immédiatement. La protection "ne pas reloader pendant
//    une séance" est gérée page-side (pwa-register.js diffère le reload
//    tant que `busy=true`).
//  - activate : suppression des caches périmés + clients.claim(), pour
//    que les pages déjà ouvertes reçoivent un `controllerchange` (qui
//    déclenche le reload côté page).
//  - navigation : cache-first sur le shell `index.html` (cold launch
//    instantané, plus aucune attente réseau pour ouvrir l'app). Le
//    fallback réseau couvre uniquement le cas pathologique où le shell
//    n'est pas dans le cache (1re install pas terminée).
//  - autre GET : cache-first puis lazy-cache si succès réseau.
//
// Historique : avant, le SW attendait un message SKIP_WAITING du page-side
// pour skipWaiting. Ça dépendait d'un `pwa-register.js` qui s'exécutait
// correctement. Si pour une raison X le page-side ne pouvait pas envoyer
// le message (bug, ancienne version cachée), les SWs s'accumulaient en
// `waiting` indéfiniment et aucune mise à jour ne se propageait. Le fait
// que la décision soit prise SW-side la rend robuste à n'importe quel
// état dégradé du code page.
//
// Les marqueurs de version, de base path et de liste d'assets sont
// substitués par scripts/build.mjs.

const CACHE = 'multiplix-' + "20260522070008"
const BASE = "/multiplix/"
const ASSETS = [
  "/multiplix/favicon.svg",
  "/multiplix/fonts/fonts.css",
  "/multiplix/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/multiplix/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/multiplix/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/multiplix/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/multiplix/icons/apple-touch-icon.png",
  "/multiplix/icons/icon-192.png",
  "/multiplix/icons/icon-512.png",
  "/multiplix/icons/icon.svg",
  "/multiplix/icons.svg",
  "/multiplix/index.html",
  "/multiplix/manifest.webmanifest",
  "/multiplix/specs/index.html",
  "/multiplix/src/App.js",
  "/multiplix/src/__tests__/badges.test.js",
  "/multiplix/src/__tests__/leitner.test.js",
  "/multiplix/src/__tests__/parseFrenchNumber.test.js",
  "/multiplix/src/__tests__/placement.test.js",
  "/multiplix/src/__tests__/sessionComposer.test.js",
  "/multiplix/src/__tests__/setup.js",
  "/multiplix/src/__tests__/strategies.test.js",
  "/multiplix/src/__tests__/streak.test.js",
  "/multiplix/src/__tests__/userJourney.test.js",
  "/multiplix/src/assets/hero.png",
  "/multiplix/src/assets/react.svg",
  "/multiplix/src/assets/vite.svg",
  "/multiplix/src/components/BackChevron.js",
  "/multiplix/src/components/Badge.js",
  "/multiplix/src/components/BadgeDetailModal.js",
  "/multiplix/src/components/DotGrid.js",
  "/multiplix/src/components/ErrorBoundary.js",
  "/multiplix/src/components/EvolutionChart.js",
  "/multiplix/src/components/Feather.js",
  "/multiplix/src/components/FeedbackModal.js",
  "/multiplix/src/components/FeedbackOverlay.js",
  "/multiplix/src/components/FlameIcon.js",
  "/multiplix/src/components/Mascot.js",
  "/multiplix/src/components/Modal.js",
  "/multiplix/src/components/MysteryImage.js",
  "/multiplix/src/components/NumPad.js",
  "/multiplix/src/components/ParentGate.js",
  "/multiplix/src/components/ProgressGrid.js",
  "/multiplix/src/components/StrategyHint.js",
  "/multiplix/src/components/StreakDetailModal.js",
  "/multiplix/src/components/VoiceInput.js",
  "/multiplix/src/env.d.js",
  "/multiplix/src/hooks/useConfetti.js",
  "/multiplix/src/hooks/useInputMode.js",
  "/multiplix/src/hooks/useSound.js",
  "/multiplix/src/hooks/useSpeechRecognition.js",
  "/multiplix/src/hooks/useTTS.js",
  "/multiplix/src/hooks/useWakeLock.js",
  "/multiplix/src/lib/audioContext.js",
  "/multiplix/src/lib/badges.js",
  "/multiplix/src/lib/changelog.js",
  "/multiplix/src/lib/facts.js",
  "/multiplix/src/lib/feedback.js",
  "/multiplix/src/lib/install.js",
  "/multiplix/src/lib/leitner.js",
  "/multiplix/src/lib/micPreflight.js",
  "/multiplix/src/lib/parseFrenchNumber.js",
  "/multiplix/src/lib/placement.js",
  "/multiplix/src/lib/sessionComposer.js",
  "/multiplix/src/lib/similarity.js",
  "/multiplix/src/lib/storage.js",
  "/multiplix/src/lib/strategies.js",
  "/multiplix/src/lib/streak.js",
  "/multiplix/src/lib/utils.js",
  "/multiplix/src/main.js",
  "/multiplix/src/screens/BadgesScreen.js",
  "/multiplix/src/screens/ChangelogScreen.js",
  "/multiplix/src/screens/HomeScreen.js",
  "/multiplix/src/screens/ParentDashboard.js",
  "/multiplix/src/screens/PrivacyScreen.js",
  "/multiplix/src/screens/ProgressScreen.js",
  "/multiplix/src/screens/RecapScreen.js",
  "/multiplix/src/screens/RulesIntroScreen.js",
  "/multiplix/src/screens/RulesScreen.js",
  "/multiplix/src/screens/SessionScreen.js",
  "/multiplix/src/screens/WelcomeScreen.js",
  "/multiplix/src/types.js",
  "/multiplix/styles.css",
  "/multiplix/vendor/preact/compat-client.mjs",
  "/multiplix/vendor/preact/compat.module.js",
  "/multiplix/vendor/preact/hooks.module.js",
  "/multiplix/vendor/preact/jsx-runtime.module.js",
  "/multiplix/vendor/preact/preact.module.js"
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  // Navigation : cache-first sur le shell. Sert le `index.html` précaché
  // sans toucher au réseau → cold launch instantané. Les nouvelles versions
  // arrivent par le mécanisme SW (cf. pwa-register.js).
  // Exceptions (équivalent du navigateFallbackDenylist VitePWA) : le guide
  // et les specs vivent sous leur propre index.html, et les previews de PR
  // vivent dans le scope du SW de prod mais ne doivent pas être masquées
  // par le shell de prod. On laisse le browser gérer.
  if (e.request.mode === 'navigate') {
    if (url.pathname.includes('/guide/') || url.pathname.includes('/specs/') || url.pathname.includes('/previews/')) {
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

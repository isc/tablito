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

const CACHE = 'tablito-' + "20260610222005"
const BASE = "/previews/fix-flaky-userjourney-rng/"
const ASSETS = [
  "/previews/fix-flaky-userjourney-rng/CNAME",
  "/previews/fix-flaky-userjourney-rng/favicon.svg",
  "/previews/fix-flaky-userjourney-rng/fonts/fonts.css",
  "/previews/fix-flaky-userjourney-rng/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/fix-flaky-userjourney-rng/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/fix-flaky-userjourney-rng/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/fix-flaky-userjourney-rng/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/fix-flaky-userjourney-rng/icons/apple-touch-icon.png",
  "/previews/fix-flaky-userjourney-rng/icons/icon-192.png",
  "/previews/fix-flaky-userjourney-rng/icons/icon-512.png",
  "/previews/fix-flaky-userjourney-rng/icons/icon.svg",
  "/previews/fix-flaky-userjourney-rng/icons.svg",
  "/previews/fix-flaky-userjourney-rng/index.html",
  "/previews/fix-flaky-userjourney-rng/manifest.webmanifest",
  "/previews/fix-flaky-userjourney-rng/specs/index.html",
  "/previews/fix-flaky-userjourney-rng/src/App.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/badges.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/dailyComposer.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/divisionBadges.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/divisionComposer.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/divisionFacts.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/divisionJourney.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/dotGrid.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/leitner.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/parseFrenchNumber.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/placement.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/recapCelebrations.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/sessionComposer.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/setup.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/strategies.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/streak.test.js",
  "/previews/fix-flaky-userjourney-rng/src/__tests__/userJourney.test.js",
  "/previews/fix-flaky-userjourney-rng/src/assets/hero.png",
  "/previews/fix-flaky-userjourney-rng/src/assets/react.svg",
  "/previews/fix-flaky-userjourney-rng/src/assets/vite.svg",
  "/previews/fix-flaky-userjourney-rng/src/components/BackChevron.js",
  "/previews/fix-flaky-userjourney-rng/src/components/Badge.js",
  "/previews/fix-flaky-userjourney-rng/src/components/BadgeDetailModal.js",
  "/previews/fix-flaky-userjourney-rng/src/components/DivisionMysteryImage.js",
  "/previews/fix-flaky-userjourney-rng/src/components/DivisionProgressGrid.js",
  "/previews/fix-flaky-userjourney-rng/src/components/DivisionStrategyHint.js",
  "/previews/fix-flaky-userjourney-rng/src/components/DotGrid.js",
  "/previews/fix-flaky-userjourney-rng/src/components/ErrorBoundary.js",
  "/previews/fix-flaky-userjourney-rng/src/components/EvolutionChart.js",
  "/previews/fix-flaky-userjourney-rng/src/components/Feather.js",
  "/previews/fix-flaky-userjourney-rng/src/components/FeedbackModal.js",
  "/previews/fix-flaky-userjourney-rng/src/components/FeedbackOverlay.js",
  "/previews/fix-flaky-userjourney-rng/src/components/FeedbackStar.js",
  "/previews/fix-flaky-userjourney-rng/src/components/FlameIcon.js",
  "/previews/fix-flaky-userjourney-rng/src/components/LeitnerGrid.js",
  "/previews/fix-flaky-userjourney-rng/src/components/Mascot.js",
  "/previews/fix-flaky-userjourney-rng/src/components/Modal.js",
  "/previews/fix-flaky-userjourney-rng/src/components/MysteryGrid.js",
  "/previews/fix-flaky-userjourney-rng/src/components/MysteryImage.js",
  "/previews/fix-flaky-userjourney-rng/src/components/NotificationSettings.js",
  "/previews/fix-flaky-userjourney-rng/src/components/NumPad.js",
  "/previews/fix-flaky-userjourney-rng/src/components/ParentGate.js",
  "/previews/fix-flaky-userjourney-rng/src/components/ProgressGrid.js",
  "/previews/fix-flaky-userjourney-rng/src/components/StrategyHint.js",
  "/previews/fix-flaky-userjourney-rng/src/components/StrategyHintShell.js",
  "/previews/fix-flaky-userjourney-rng/src/components/StreakDetailModal.js",
  "/previews/fix-flaky-userjourney-rng/src/components/VoiceInput.js",
  "/previews/fix-flaky-userjourney-rng/src/env.d.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useConfetti.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useInputMode.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useSound.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useSpeechRecognition.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useTTS.js",
  "/previews/fix-flaky-userjourney-rng/src/hooks/useWakeLock.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/audioContext.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/badges.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/changelog.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/dailyComposer.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/divisionComposer.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/divisionFacts.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/divisionStrategies.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/facts.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/feedback.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/hardestFacts.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/install.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/leitner.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/micPreflight.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/parseFrenchNumber.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/placement.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/push.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/sessionComposer.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/similarity.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/storage.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/strategies.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/streak.js",
  "/previews/fix-flaky-userjourney-rng/src/lib/utils.js",
  "/previews/fix-flaky-userjourney-rng/src/main.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/BadgesScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/ChangelogScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/HomeScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/ParentDashboard.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/PrivacyScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/ProgressScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/RecapScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/RulesIntroScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/RulesScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/SessionScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/screens/WelcomeScreen.js",
  "/previews/fix-flaky-userjourney-rng/src/types.js",
  "/previews/fix-flaky-userjourney-rng/styles.css",
  "/previews/fix-flaky-userjourney-rng/vendor/preact/compat-client.mjs",
  "/previews/fix-flaky-userjourney-rng/vendor/preact/compat.module.js",
  "/previews/fix-flaky-userjourney-rng/vendor/preact/hooks.module.js",
  "/previews/fix-flaky-userjourney-rng/vendor/preact/jsx-runtime.module.js",
  "/previews/fix-flaky-userjourney-rng/vendor/preact/preact.module.js"
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

// Push : rappel quotidien (cf. scripts/send-reminders.mjs). Le payload est un
// JSON {title, body, url}. Fallback défensif si le payload manque/est illisible.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = {} }
  const title = data.title || 'Tablito'
  const body = data.body || "C'est l'heure de ta séance Tablito ! 🎯"
  const url = data.url || BASE
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      tag: 'daily-reminder', // remplace une notif précédente non lue plutôt que d'empiler
      data: { url },
    })
  )
})

// Clic sur la notif : focus une fenêtre de l'app déjà ouverte, sinon en ouvre une.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || BASE
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})

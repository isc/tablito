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

const CACHE = 'tablito-' + "20260610202031"
const BASE = "/tablito/"
const ASSETS = [
  "/tablito/favicon.svg",
  "/tablito/fonts/fonts.css",
  "/tablito/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/tablito/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/tablito/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/tablito/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/tablito/icons/apple-touch-icon.png",
  "/tablito/icons/icon-192.png",
  "/tablito/icons/icon-512.png",
  "/tablito/icons/icon.svg",
  "/tablito/icons.svg",
  "/tablito/index.html",
  "/tablito/manifest.webmanifest",
  "/tablito/specs/index.html",
  "/tablito/src/App.js",
  "/tablito/src/__tests__/badges.test.js",
  "/tablito/src/__tests__/dailyComposer.test.js",
  "/tablito/src/__tests__/divisionBadges.test.js",
  "/tablito/src/__tests__/divisionComposer.test.js",
  "/tablito/src/__tests__/divisionFacts.test.js",
  "/tablito/src/__tests__/divisionJourney.test.js",
  "/tablito/src/__tests__/dotGrid.test.js",
  "/tablito/src/__tests__/leitner.test.js",
  "/tablito/src/__tests__/parseFrenchNumber.test.js",
  "/tablito/src/__tests__/placement.test.js",
  "/tablito/src/__tests__/recapCelebrations.test.js",
  "/tablito/src/__tests__/sessionComposer.test.js",
  "/tablito/src/__tests__/setup.js",
  "/tablito/src/__tests__/strategies.test.js",
  "/tablito/src/__tests__/streak.test.js",
  "/tablito/src/__tests__/userJourney.test.js",
  "/tablito/src/assets/hero.png",
  "/tablito/src/assets/react.svg",
  "/tablito/src/assets/vite.svg",
  "/tablito/src/components/BackChevron.js",
  "/tablito/src/components/Badge.js",
  "/tablito/src/components/BadgeDetailModal.js",
  "/tablito/src/components/DivisionMysteryImage.js",
  "/tablito/src/components/DivisionProgressGrid.js",
  "/tablito/src/components/DivisionStrategyHint.js",
  "/tablito/src/components/DotGrid.js",
  "/tablito/src/components/ErrorBoundary.js",
  "/tablito/src/components/EvolutionChart.js",
  "/tablito/src/components/Feather.js",
  "/tablito/src/components/FeedbackModal.js",
  "/tablito/src/components/FeedbackOverlay.js",
  "/tablito/src/components/FeedbackStar.js",
  "/tablito/src/components/FlameIcon.js",
  "/tablito/src/components/LeitnerGrid.js",
  "/tablito/src/components/Mascot.js",
  "/tablito/src/components/Modal.js",
  "/tablito/src/components/MysteryGrid.js",
  "/tablito/src/components/MysteryImage.js",
  "/tablito/src/components/NotificationSettings.js",
  "/tablito/src/components/NumPad.js",
  "/tablito/src/components/ParentGate.js",
  "/tablito/src/components/ProgressGrid.js",
  "/tablito/src/components/StrategyHint.js",
  "/tablito/src/components/StrategyHintShell.js",
  "/tablito/src/components/StreakDetailModal.js",
  "/tablito/src/components/VoiceInput.js",
  "/tablito/src/env.d.js",
  "/tablito/src/hooks/useConfetti.js",
  "/tablito/src/hooks/useInputMode.js",
  "/tablito/src/hooks/useSound.js",
  "/tablito/src/hooks/useSpeechRecognition.js",
  "/tablito/src/hooks/useTTS.js",
  "/tablito/src/hooks/useWakeLock.js",
  "/tablito/src/lib/audioContext.js",
  "/tablito/src/lib/badges.js",
  "/tablito/src/lib/changelog.js",
  "/tablito/src/lib/dailyComposer.js",
  "/tablito/src/lib/divisionComposer.js",
  "/tablito/src/lib/divisionFacts.js",
  "/tablito/src/lib/divisionStrategies.js",
  "/tablito/src/lib/facts.js",
  "/tablito/src/lib/feedback.js",
  "/tablito/src/lib/hardestFacts.js",
  "/tablito/src/lib/install.js",
  "/tablito/src/lib/leitner.js",
  "/tablito/src/lib/micPreflight.js",
  "/tablito/src/lib/parseFrenchNumber.js",
  "/tablito/src/lib/placement.js",
  "/tablito/src/lib/push.js",
  "/tablito/src/lib/sessionComposer.js",
  "/tablito/src/lib/similarity.js",
  "/tablito/src/lib/storage.js",
  "/tablito/src/lib/strategies.js",
  "/tablito/src/lib/streak.js",
  "/tablito/src/lib/utils.js",
  "/tablito/src/main.js",
  "/tablito/src/screens/BadgesScreen.js",
  "/tablito/src/screens/ChangelogScreen.js",
  "/tablito/src/screens/HomeScreen.js",
  "/tablito/src/screens/ParentDashboard.js",
  "/tablito/src/screens/PrivacyScreen.js",
  "/tablito/src/screens/ProgressScreen.js",
  "/tablito/src/screens/RecapScreen.js",
  "/tablito/src/screens/RulesIntroScreen.js",
  "/tablito/src/screens/RulesScreen.js",
  "/tablito/src/screens/SessionScreen.js",
  "/tablito/src/screens/WelcomeScreen.js",
  "/tablito/src/types.js",
  "/tablito/styles.css",
  "/tablito/vendor/preact/compat-client.mjs",
  "/tablito/vendor/preact/compat.module.js",
  "/tablito/vendor/preact/hooks.module.js",
  "/tablito/vendor/preact/jsx-runtime.module.js",
  "/tablito/vendor/preact/preact.module.js"
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

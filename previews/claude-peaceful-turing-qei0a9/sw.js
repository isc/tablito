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

const CACHE = 'tablito-' + "20260612192102"
const BASE = "/previews/claude-peaceful-turing-qei0a9/"
const ASSETS = [
  "/previews/claude-peaceful-turing-qei0a9/CNAME",
  "/previews/claude-peaceful-turing-qei0a9/favicon.svg",
  "/previews/claude-peaceful-turing-qei0a9/fonts/fonts.css",
  "/previews/claude-peaceful-turing-qei0a9/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/claude-peaceful-turing-qei0a9/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/claude-peaceful-turing-qei0a9/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/claude-peaceful-turing-qei0a9/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/claude-peaceful-turing-qei0a9/icons/apple-touch-icon.png",
  "/previews/claude-peaceful-turing-qei0a9/icons/icon-192.png",
  "/previews/claude-peaceful-turing-qei0a9/icons/icon-512.png",
  "/previews/claude-peaceful-turing-qei0a9/icons/icon.svg",
  "/previews/claude-peaceful-turing-qei0a9/icons.svg",
  "/previews/claude-peaceful-turing-qei0a9/index.html",
  "/previews/claude-peaceful-turing-qei0a9/manifest.webmanifest",
  "/previews/claude-peaceful-turing-qei0a9/specs/index.html",
  "/previews/claude-peaceful-turing-qei0a9/src/App.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/badges.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/dailyComposer.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/divisionBadges.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/divisionComposer.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/divisionFacts.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/divisionJourney.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/dotGrid.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/leitner.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/mixedSessionTTS.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/multiProfile.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/parseFrenchNumber.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/placement.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/recapCelebrations.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/sessionComposer.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/setup.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/strategies.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/streak.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/__tests__/userJourney.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/assets/hero.png",
  "/previews/claude-peaceful-turing-qei0a9/src/assets/react.svg",
  "/previews/claude-peaceful-turing-qei0a9/src/assets/vite.svg",
  "/previews/claude-peaceful-turing-qei0a9/src/components/BackChevron.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/Badge.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/BadgeDetailModal.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/DivisionMysteryImage.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/DivisionProgressGrid.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/DivisionStrategyHint.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/DotGrid.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/ErrorBoundary.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/EvolutionChart.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/Feather.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/FeedbackModal.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/FeedbackOverlay.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/FeedbackStar.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/FlameIcon.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/LeitnerGrid.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/Mascot.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/Modal.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/MysteryGrid.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/MysteryImage.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/NotificationSettings.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/NumPad.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/ParentGate.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/ProgressGrid.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/StrategyHint.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/StrategyHintShell.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/StreakDetailModal.js",
  "/previews/claude-peaceful-turing-qei0a9/src/components/VoiceInput.js",
  "/previews/claude-peaceful-turing-qei0a9/src/env.d.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useConfetti.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useInputMode.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useSound.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useSpeechRecognition.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useSpeechRecognition.test.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useTTS.js",
  "/previews/claude-peaceful-turing-qei0a9/src/hooks/useWakeLock.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/audioContext.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/badges.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/changelog.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/dailyComposer.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/divisionComposer.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/divisionFacts.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/divisionStrategies.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/facts.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/feedback.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/hardestFacts.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/install.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/leitner.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/micPreflight.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/parseFrenchNumber.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/placement.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/push.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/sessionComposer.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/similarity.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/storage.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/strategies.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/streak.js",
  "/previews/claude-peaceful-turing-qei0a9/src/lib/utils.js",
  "/previews/claude-peaceful-turing-qei0a9/src/main.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/BadgesScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/ChangelogScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/HomeScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/ParentDashboard.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/PrivacyScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/ProfileSelectScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/ProgressScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/RecapScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/RulesIntroScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/RulesScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/SessionScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/screens/WelcomeScreen.js",
  "/previews/claude-peaceful-turing-qei0a9/src/types.js",
  "/previews/claude-peaceful-turing-qei0a9/styles.css",
  "/previews/claude-peaceful-turing-qei0a9/vendor/preact/compat-client.mjs",
  "/previews/claude-peaceful-turing-qei0a9/vendor/preact/compat.module.js",
  "/previews/claude-peaceful-turing-qei0a9/vendor/preact/hooks.module.js",
  "/previews/claude-peaceful-turing-qei0a9/vendor/preact/jsx-runtime.module.js",
  "/previews/claude-peaceful-turing-qei0a9/vendor/preact/preact.module.js"
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

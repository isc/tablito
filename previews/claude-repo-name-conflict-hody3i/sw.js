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

const CACHE = 'tablito-' + "20260610194359"
const BASE = "/tablito/previews/claude-repo-name-conflict-hody3i/"
const ASSETS = [
  "/tablito/previews/claude-repo-name-conflict-hody3i/favicon.svg",
  "/tablito/previews/claude-repo-name-conflict-hody3i/fonts/fonts.css",
  "/tablito/previews/claude-repo-name-conflict-hody3i/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/tablito/previews/claude-repo-name-conflict-hody3i/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/tablito/previews/claude-repo-name-conflict-hody3i/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/tablito/previews/claude-repo-name-conflict-hody3i/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/tablito/previews/claude-repo-name-conflict-hody3i/icons/apple-touch-icon.png",
  "/tablito/previews/claude-repo-name-conflict-hody3i/icons/icon-192.png",
  "/tablito/previews/claude-repo-name-conflict-hody3i/icons/icon-512.png",
  "/tablito/previews/claude-repo-name-conflict-hody3i/icons/icon.svg",
  "/tablito/previews/claude-repo-name-conflict-hody3i/icons.svg",
  "/tablito/previews/claude-repo-name-conflict-hody3i/index.html",
  "/tablito/previews/claude-repo-name-conflict-hody3i/manifest.webmanifest",
  "/tablito/previews/claude-repo-name-conflict-hody3i/specs/index.html",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/App.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/badges.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/dailyComposer.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionBadges.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionComposer.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionFacts.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionJourney.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/dotGrid.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/leitner.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/parseFrenchNumber.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/placement.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/recapCelebrations.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/sessionComposer.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/setup.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/strategies.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/streak.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/__tests__/userJourney.test.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/assets/hero.png",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/assets/react.svg",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/assets/vite.svg",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/BackChevron.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/Badge.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/BadgeDetailModal.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/DivisionMysteryImage.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/DivisionProgressGrid.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/DivisionStrategyHint.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/DotGrid.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/ErrorBoundary.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/EvolutionChart.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/Feather.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackModal.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackOverlay.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackStar.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/FlameIcon.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/LeitnerGrid.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/Mascot.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/Modal.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/MysteryGrid.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/MysteryImage.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/NotificationSettings.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/NumPad.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/ParentGate.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/ProgressGrid.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/StrategyHint.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/StrategyHintShell.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/StreakDetailModal.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/components/VoiceInput.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/env.d.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useConfetti.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useInputMode.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useSound.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useSpeechRecognition.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useTTS.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/hooks/useWakeLock.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/audioContext.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/badges.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/changelog.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/dailyComposer.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/divisionComposer.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/divisionFacts.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/divisionStrategies.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/facts.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/feedback.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/hardestFacts.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/install.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/leitner.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/micPreflight.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/parseFrenchNumber.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/placement.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/push.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/sessionComposer.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/similarity.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/storage.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/strategies.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/streak.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/lib/utils.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/main.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/BadgesScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/ChangelogScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/HomeScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/ParentDashboard.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/PrivacyScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/ProgressScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/RecapScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/RulesIntroScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/RulesScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/SessionScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/screens/WelcomeScreen.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/src/types.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/styles.css",
  "/tablito/previews/claude-repo-name-conflict-hody3i/vendor/preact/compat-client.mjs",
  "/tablito/previews/claude-repo-name-conflict-hody3i/vendor/preact/compat.module.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/vendor/preact/hooks.module.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/vendor/preact/jsx-runtime.module.js",
  "/tablito/previews/claude-repo-name-conflict-hody3i/vendor/preact/preact.module.js"
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

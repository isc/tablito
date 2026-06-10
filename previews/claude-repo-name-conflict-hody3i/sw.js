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

const CACHE = 'tablito-' + "20260610204745"
const BASE = "/previews/claude-repo-name-conflict-hody3i/"
const ASSETS = [
  "/previews/claude-repo-name-conflict-hody3i/CNAME",
  "/previews/claude-repo-name-conflict-hody3i/favicon.svg",
  "/previews/claude-repo-name-conflict-hody3i/fonts/fonts.css",
  "/previews/claude-repo-name-conflict-hody3i/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/claude-repo-name-conflict-hody3i/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/claude-repo-name-conflict-hody3i/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/claude-repo-name-conflict-hody3i/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/claude-repo-name-conflict-hody3i/icons/apple-touch-icon.png",
  "/previews/claude-repo-name-conflict-hody3i/icons/icon-192.png",
  "/previews/claude-repo-name-conflict-hody3i/icons/icon-512.png",
  "/previews/claude-repo-name-conflict-hody3i/icons/icon.svg",
  "/previews/claude-repo-name-conflict-hody3i/icons.svg",
  "/previews/claude-repo-name-conflict-hody3i/index.html",
  "/previews/claude-repo-name-conflict-hody3i/manifest.webmanifest",
  "/previews/claude-repo-name-conflict-hody3i/specs/index.html",
  "/previews/claude-repo-name-conflict-hody3i/src/App.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/badges.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/dailyComposer.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionBadges.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionComposer.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionFacts.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/divisionJourney.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/dotGrid.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/leitner.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/parseFrenchNumber.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/placement.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/recapCelebrations.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/sessionComposer.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/setup.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/strategies.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/streak.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/__tests__/userJourney.test.js",
  "/previews/claude-repo-name-conflict-hody3i/src/assets/hero.png",
  "/previews/claude-repo-name-conflict-hody3i/src/assets/react.svg",
  "/previews/claude-repo-name-conflict-hody3i/src/assets/vite.svg",
  "/previews/claude-repo-name-conflict-hody3i/src/components/BackChevron.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/Badge.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/BadgeDetailModal.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/DivisionMysteryImage.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/DivisionProgressGrid.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/DivisionStrategyHint.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/DotGrid.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/ErrorBoundary.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/EvolutionChart.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/Feather.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackModal.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackOverlay.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/FeedbackStar.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/FlameIcon.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/LeitnerGrid.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/Mascot.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/Modal.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/MysteryGrid.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/MysteryImage.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/NotificationSettings.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/NumPad.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/ParentGate.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/ProgressGrid.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/StrategyHint.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/StrategyHintShell.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/StreakDetailModal.js",
  "/previews/claude-repo-name-conflict-hody3i/src/components/VoiceInput.js",
  "/previews/claude-repo-name-conflict-hody3i/src/env.d.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useConfetti.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useInputMode.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useSound.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useSpeechRecognition.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useTTS.js",
  "/previews/claude-repo-name-conflict-hody3i/src/hooks/useWakeLock.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/audioContext.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/badges.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/changelog.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/dailyComposer.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/divisionComposer.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/divisionFacts.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/divisionStrategies.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/facts.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/feedback.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/hardestFacts.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/install.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/leitner.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/micPreflight.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/parseFrenchNumber.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/placement.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/push.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/sessionComposer.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/similarity.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/storage.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/strategies.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/streak.js",
  "/previews/claude-repo-name-conflict-hody3i/src/lib/utils.js",
  "/previews/claude-repo-name-conflict-hody3i/src/main.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/BadgesScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/ChangelogScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/HomeScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/ParentDashboard.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/PrivacyScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/ProgressScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/RecapScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/RulesIntroScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/RulesScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/SessionScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/screens/WelcomeScreen.js",
  "/previews/claude-repo-name-conflict-hody3i/src/types.js",
  "/previews/claude-repo-name-conflict-hody3i/styles.css",
  "/previews/claude-repo-name-conflict-hody3i/vendor/preact/compat-client.mjs",
  "/previews/claude-repo-name-conflict-hody3i/vendor/preact/compat.module.js",
  "/previews/claude-repo-name-conflict-hody3i/vendor/preact/hooks.module.js",
  "/previews/claude-repo-name-conflict-hody3i/vendor/preact/jsx-runtime.module.js",
  "/previews/claude-repo-name-conflict-hody3i/vendor/preact/preact.module.js"
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

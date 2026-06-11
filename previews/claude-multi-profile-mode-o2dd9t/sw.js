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

const CACHE = 'tablito-' + "20260611190444"
const BASE = "/previews/claude-multi-profile-mode-o2dd9t/"
const ASSETS = [
  "/previews/claude-multi-profile-mode-o2dd9t/CNAME",
  "/previews/claude-multi-profile-mode-o2dd9t/favicon.svg",
  "/previews/claude-multi-profile-mode-o2dd9t/fonts/fonts.css",
  "/previews/claude-multi-profile-mode-o2dd9t/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/claude-multi-profile-mode-o2dd9t/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/claude-multi-profile-mode-o2dd9t/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/claude-multi-profile-mode-o2dd9t/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/claude-multi-profile-mode-o2dd9t/icons/apple-touch-icon.png",
  "/previews/claude-multi-profile-mode-o2dd9t/icons/icon-192.png",
  "/previews/claude-multi-profile-mode-o2dd9t/icons/icon-512.png",
  "/previews/claude-multi-profile-mode-o2dd9t/icons/icon.svg",
  "/previews/claude-multi-profile-mode-o2dd9t/icons.svg",
  "/previews/claude-multi-profile-mode-o2dd9t/index.html",
  "/previews/claude-multi-profile-mode-o2dd9t/manifest.webmanifest",
  "/previews/claude-multi-profile-mode-o2dd9t/specs/index.html",
  "/previews/claude-multi-profile-mode-o2dd9t/src/App.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/badges.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/dailyComposer.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/divisionBadges.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/divisionComposer.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/divisionFacts.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/divisionJourney.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/dotGrid.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/leitner.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/multiProfile.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/parseFrenchNumber.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/placement.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/recapCelebrations.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/sessionComposer.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/setup.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/strategies.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/streak.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/__tests__/userJourney.test.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/assets/hero.png",
  "/previews/claude-multi-profile-mode-o2dd9t/src/assets/react.svg",
  "/previews/claude-multi-profile-mode-o2dd9t/src/assets/vite.svg",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/BackChevron.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/Badge.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/BadgeDetailModal.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/DivisionMysteryImage.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/DivisionProgressGrid.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/DivisionStrategyHint.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/DotGrid.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/ErrorBoundary.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/EvolutionChart.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/Feather.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/FeedbackModal.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/FeedbackOverlay.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/FeedbackStar.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/FlameIcon.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/LeitnerGrid.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/Mascot.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/Modal.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/MysteryGrid.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/MysteryImage.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/NotificationSettings.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/NumPad.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/ParentGate.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/ProgressGrid.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/StrategyHint.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/StrategyHintShell.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/StreakDetailModal.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/components/VoiceInput.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/env.d.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useConfetti.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useInputMode.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useSound.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useSpeechRecognition.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useTTS.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/hooks/useWakeLock.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/audioContext.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/badges.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/changelog.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/dailyComposer.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/divisionComposer.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/divisionFacts.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/divisionStrategies.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/facts.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/feedback.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/hardestFacts.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/install.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/leitner.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/micPreflight.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/parseFrenchNumber.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/placement.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/push.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/sessionComposer.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/similarity.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/storage.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/strategies.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/streak.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/lib/utils.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/main.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/BadgesScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/ChangelogScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/HomeScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/ParentDashboard.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/PrivacyScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/ProfileSelectScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/ProgressScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/RecapScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/RulesIntroScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/RulesScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/SessionScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/screens/WelcomeScreen.js",
  "/previews/claude-multi-profile-mode-o2dd9t/src/types.js",
  "/previews/claude-multi-profile-mode-o2dd9t/styles.css",
  "/previews/claude-multi-profile-mode-o2dd9t/vendor/preact/compat-client.mjs",
  "/previews/claude-multi-profile-mode-o2dd9t/vendor/preact/compat.module.js",
  "/previews/claude-multi-profile-mode-o2dd9t/vendor/preact/hooks.module.js",
  "/previews/claude-multi-profile-mode-o2dd9t/vendor/preact/jsx-runtime.module.js",
  "/previews/claude-multi-profile-mode-o2dd9t/vendor/preact/preact.module.js"
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

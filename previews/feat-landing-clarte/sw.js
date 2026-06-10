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

const CACHE = 'tablito-' + "20260610215016"
const BASE = "/previews/feat-landing-clarte/"
const ASSETS = [
  "/previews/feat-landing-clarte/CNAME",
  "/previews/feat-landing-clarte/favicon.svg",
  "/previews/feat-landing-clarte/fonts/fonts.css",
  "/previews/feat-landing-clarte/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/feat-landing-clarte/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/feat-landing-clarte/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/feat-landing-clarte/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/feat-landing-clarte/icons/apple-touch-icon.png",
  "/previews/feat-landing-clarte/icons/icon-192.png",
  "/previews/feat-landing-clarte/icons/icon-512.png",
  "/previews/feat-landing-clarte/icons/icon.svg",
  "/previews/feat-landing-clarte/icons.svg",
  "/previews/feat-landing-clarte/index.html",
  "/previews/feat-landing-clarte/manifest.webmanifest",
  "/previews/feat-landing-clarte/specs/index.html",
  "/previews/feat-landing-clarte/src/App.js",
  "/previews/feat-landing-clarte/src/__tests__/badges.test.js",
  "/previews/feat-landing-clarte/src/__tests__/dailyComposer.test.js",
  "/previews/feat-landing-clarte/src/__tests__/divisionBadges.test.js",
  "/previews/feat-landing-clarte/src/__tests__/divisionComposer.test.js",
  "/previews/feat-landing-clarte/src/__tests__/divisionFacts.test.js",
  "/previews/feat-landing-clarte/src/__tests__/divisionJourney.test.js",
  "/previews/feat-landing-clarte/src/__tests__/dotGrid.test.js",
  "/previews/feat-landing-clarte/src/__tests__/leitner.test.js",
  "/previews/feat-landing-clarte/src/__tests__/parseFrenchNumber.test.js",
  "/previews/feat-landing-clarte/src/__tests__/placement.test.js",
  "/previews/feat-landing-clarte/src/__tests__/recapCelebrations.test.js",
  "/previews/feat-landing-clarte/src/__tests__/sessionComposer.test.js",
  "/previews/feat-landing-clarte/src/__tests__/setup.js",
  "/previews/feat-landing-clarte/src/__tests__/strategies.test.js",
  "/previews/feat-landing-clarte/src/__tests__/streak.test.js",
  "/previews/feat-landing-clarte/src/__tests__/userJourney.test.js",
  "/previews/feat-landing-clarte/src/assets/hero.png",
  "/previews/feat-landing-clarte/src/assets/react.svg",
  "/previews/feat-landing-clarte/src/assets/vite.svg",
  "/previews/feat-landing-clarte/src/components/BackChevron.js",
  "/previews/feat-landing-clarte/src/components/Badge.js",
  "/previews/feat-landing-clarte/src/components/BadgeDetailModal.js",
  "/previews/feat-landing-clarte/src/components/DivisionMysteryImage.js",
  "/previews/feat-landing-clarte/src/components/DivisionProgressGrid.js",
  "/previews/feat-landing-clarte/src/components/DivisionStrategyHint.js",
  "/previews/feat-landing-clarte/src/components/DotGrid.js",
  "/previews/feat-landing-clarte/src/components/ErrorBoundary.js",
  "/previews/feat-landing-clarte/src/components/EvolutionChart.js",
  "/previews/feat-landing-clarte/src/components/Feather.js",
  "/previews/feat-landing-clarte/src/components/FeedbackModal.js",
  "/previews/feat-landing-clarte/src/components/FeedbackOverlay.js",
  "/previews/feat-landing-clarte/src/components/FeedbackStar.js",
  "/previews/feat-landing-clarte/src/components/FlameIcon.js",
  "/previews/feat-landing-clarte/src/components/LeitnerGrid.js",
  "/previews/feat-landing-clarte/src/components/Mascot.js",
  "/previews/feat-landing-clarte/src/components/Modal.js",
  "/previews/feat-landing-clarte/src/components/MysteryGrid.js",
  "/previews/feat-landing-clarte/src/components/MysteryImage.js",
  "/previews/feat-landing-clarte/src/components/NotificationSettings.js",
  "/previews/feat-landing-clarte/src/components/NumPad.js",
  "/previews/feat-landing-clarte/src/components/ParentGate.js",
  "/previews/feat-landing-clarte/src/components/ProgressGrid.js",
  "/previews/feat-landing-clarte/src/components/StrategyHint.js",
  "/previews/feat-landing-clarte/src/components/StrategyHintShell.js",
  "/previews/feat-landing-clarte/src/components/StreakDetailModal.js",
  "/previews/feat-landing-clarte/src/components/VoiceInput.js",
  "/previews/feat-landing-clarte/src/env.d.js",
  "/previews/feat-landing-clarte/src/hooks/useConfetti.js",
  "/previews/feat-landing-clarte/src/hooks/useInputMode.js",
  "/previews/feat-landing-clarte/src/hooks/useSound.js",
  "/previews/feat-landing-clarte/src/hooks/useSpeechRecognition.js",
  "/previews/feat-landing-clarte/src/hooks/useTTS.js",
  "/previews/feat-landing-clarte/src/hooks/useWakeLock.js",
  "/previews/feat-landing-clarte/src/lib/audioContext.js",
  "/previews/feat-landing-clarte/src/lib/badges.js",
  "/previews/feat-landing-clarte/src/lib/changelog.js",
  "/previews/feat-landing-clarte/src/lib/dailyComposer.js",
  "/previews/feat-landing-clarte/src/lib/divisionComposer.js",
  "/previews/feat-landing-clarte/src/lib/divisionFacts.js",
  "/previews/feat-landing-clarte/src/lib/divisionStrategies.js",
  "/previews/feat-landing-clarte/src/lib/facts.js",
  "/previews/feat-landing-clarte/src/lib/feedback.js",
  "/previews/feat-landing-clarte/src/lib/hardestFacts.js",
  "/previews/feat-landing-clarte/src/lib/install.js",
  "/previews/feat-landing-clarte/src/lib/leitner.js",
  "/previews/feat-landing-clarte/src/lib/micPreflight.js",
  "/previews/feat-landing-clarte/src/lib/parseFrenchNumber.js",
  "/previews/feat-landing-clarte/src/lib/placement.js",
  "/previews/feat-landing-clarte/src/lib/push.js",
  "/previews/feat-landing-clarte/src/lib/sessionComposer.js",
  "/previews/feat-landing-clarte/src/lib/similarity.js",
  "/previews/feat-landing-clarte/src/lib/storage.js",
  "/previews/feat-landing-clarte/src/lib/strategies.js",
  "/previews/feat-landing-clarte/src/lib/streak.js",
  "/previews/feat-landing-clarte/src/lib/utils.js",
  "/previews/feat-landing-clarte/src/main.js",
  "/previews/feat-landing-clarte/src/screens/BadgesScreen.js",
  "/previews/feat-landing-clarte/src/screens/ChangelogScreen.js",
  "/previews/feat-landing-clarte/src/screens/HomeScreen.js",
  "/previews/feat-landing-clarte/src/screens/ParentDashboard.js",
  "/previews/feat-landing-clarte/src/screens/PrivacyScreen.js",
  "/previews/feat-landing-clarte/src/screens/ProgressScreen.js",
  "/previews/feat-landing-clarte/src/screens/RecapScreen.js",
  "/previews/feat-landing-clarte/src/screens/RulesIntroScreen.js",
  "/previews/feat-landing-clarte/src/screens/RulesScreen.js",
  "/previews/feat-landing-clarte/src/screens/SessionScreen.js",
  "/previews/feat-landing-clarte/src/screens/WelcomeScreen.js",
  "/previews/feat-landing-clarte/src/types.js",
  "/previews/feat-landing-clarte/styles.css",
  "/previews/feat-landing-clarte/vendor/preact/compat-client.mjs",
  "/previews/feat-landing-clarte/vendor/preact/compat.module.js",
  "/previews/feat-landing-clarte/vendor/preact/hooks.module.js",
  "/previews/feat-landing-clarte/vendor/preact/jsx-runtime.module.js",
  "/previews/feat-landing-clarte/vendor/preact/preact.module.js"
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

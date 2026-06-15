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

const CACHE = 'tablito-' + "20260615074121"
const BASE = "/previews/fix-intro-derniers-faits/"
const ASSETS = [
  "/previews/fix-intro-derniers-faits/CNAME",
  "/previews/fix-intro-derniers-faits/favicon.svg",
  "/previews/fix-intro-derniers-faits/fonts/fonts.css",
  "/previews/fix-intro-derniers-faits/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/fix-intro-derniers-faits/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/fix-intro-derniers-faits/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/fix-intro-derniers-faits/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/fix-intro-derniers-faits/icons/apple-touch-icon.png",
  "/previews/fix-intro-derniers-faits/icons/icon-192.png",
  "/previews/fix-intro-derniers-faits/icons/icon-512.png",
  "/previews/fix-intro-derniers-faits/icons/icon.svg",
  "/previews/fix-intro-derniers-faits/icons.svg",
  "/previews/fix-intro-derniers-faits/index.html",
  "/previews/fix-intro-derniers-faits/manifest.webmanifest",
  "/previews/fix-intro-derniers-faits/specs/index.html",
  "/previews/fix-intro-derniers-faits/src/App.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/badges.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/dailyComposer.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/divisionBadges.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/divisionComposer.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/divisionFacts.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/divisionJourney.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/dotGrid.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/leitner.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/mixedSessionTTS.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/multiProfile.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/parseFrenchNumber.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/placement.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/recapCelebrations.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/sessionComposer.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/setup.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/strategies.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/streak.test.js",
  "/previews/fix-intro-derniers-faits/src/__tests__/userJourney.test.js",
  "/previews/fix-intro-derniers-faits/src/assets/hero.png",
  "/previews/fix-intro-derniers-faits/src/assets/react.svg",
  "/previews/fix-intro-derniers-faits/src/assets/vite.svg",
  "/previews/fix-intro-derniers-faits/src/components/BackChevron.js",
  "/previews/fix-intro-derniers-faits/src/components/Badge.js",
  "/previews/fix-intro-derniers-faits/src/components/BadgeDetailModal.js",
  "/previews/fix-intro-derniers-faits/src/components/DivisionMysteryImage.js",
  "/previews/fix-intro-derniers-faits/src/components/DivisionProgressGrid.js",
  "/previews/fix-intro-derniers-faits/src/components/DivisionStrategyHint.js",
  "/previews/fix-intro-derniers-faits/src/components/DotGrid.js",
  "/previews/fix-intro-derniers-faits/src/components/ErrorBoundary.js",
  "/previews/fix-intro-derniers-faits/src/components/EvolutionChart.js",
  "/previews/fix-intro-derniers-faits/src/components/Feather.js",
  "/previews/fix-intro-derniers-faits/src/components/FeedbackModal.js",
  "/previews/fix-intro-derniers-faits/src/components/FeedbackOverlay.js",
  "/previews/fix-intro-derniers-faits/src/components/FeedbackStar.js",
  "/previews/fix-intro-derniers-faits/src/components/FlameIcon.js",
  "/previews/fix-intro-derniers-faits/src/components/LeitnerGrid.js",
  "/previews/fix-intro-derniers-faits/src/components/Mascot.js",
  "/previews/fix-intro-derniers-faits/src/components/Modal.js",
  "/previews/fix-intro-derniers-faits/src/components/MysteryGrid.js",
  "/previews/fix-intro-derniers-faits/src/components/MysteryImage.js",
  "/previews/fix-intro-derniers-faits/src/components/NotificationSettings.js",
  "/previews/fix-intro-derniers-faits/src/components/NumPad.js",
  "/previews/fix-intro-derniers-faits/src/components/ParentGate.js",
  "/previews/fix-intro-derniers-faits/src/components/ProgressGrid.js",
  "/previews/fix-intro-derniers-faits/src/components/StrategyHint.js",
  "/previews/fix-intro-derniers-faits/src/components/StrategyHintShell.js",
  "/previews/fix-intro-derniers-faits/src/components/StreakDetailModal.js",
  "/previews/fix-intro-derniers-faits/src/components/VoiceInput.js",
  "/previews/fix-intro-derniers-faits/src/env.d.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useConfetti.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useInputMode.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useSound.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useSpeechRecognition.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useSpeechRecognition.test.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useTTS.js",
  "/previews/fix-intro-derniers-faits/src/hooks/useWakeLock.js",
  "/previews/fix-intro-derniers-faits/src/lib/audioContext.js",
  "/previews/fix-intro-derniers-faits/src/lib/badges.js",
  "/previews/fix-intro-derniers-faits/src/lib/changelog.js",
  "/previews/fix-intro-derniers-faits/src/lib/dailyComposer.js",
  "/previews/fix-intro-derniers-faits/src/lib/divisionComposer.js",
  "/previews/fix-intro-derniers-faits/src/lib/divisionFacts.js",
  "/previews/fix-intro-derniers-faits/src/lib/divisionStrategies.js",
  "/previews/fix-intro-derniers-faits/src/lib/facts.js",
  "/previews/fix-intro-derniers-faits/src/lib/feedback.js",
  "/previews/fix-intro-derniers-faits/src/lib/hardestFacts.js",
  "/previews/fix-intro-derniers-faits/src/lib/install.js",
  "/previews/fix-intro-derniers-faits/src/lib/leitner.js",
  "/previews/fix-intro-derniers-faits/src/lib/micPreflight.js",
  "/previews/fix-intro-derniers-faits/src/lib/parseFrenchNumber.js",
  "/previews/fix-intro-derniers-faits/src/lib/placement.js",
  "/previews/fix-intro-derniers-faits/src/lib/push.js",
  "/previews/fix-intro-derniers-faits/src/lib/sessionComposer.js",
  "/previews/fix-intro-derniers-faits/src/lib/similarity.js",
  "/previews/fix-intro-derniers-faits/src/lib/storage.js",
  "/previews/fix-intro-derniers-faits/src/lib/strategies.js",
  "/previews/fix-intro-derniers-faits/src/lib/streak.js",
  "/previews/fix-intro-derniers-faits/src/lib/utils.js",
  "/previews/fix-intro-derniers-faits/src/main.js",
  "/previews/fix-intro-derniers-faits/src/screens/BadgesScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/ChangelogScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/HomeScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/ParentDashboard.js",
  "/previews/fix-intro-derniers-faits/src/screens/PrivacyScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/ProfileSelectScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/ProgressScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/RecapScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/RulesIntroScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/RulesScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/SessionScreen.js",
  "/previews/fix-intro-derniers-faits/src/screens/WelcomeScreen.js",
  "/previews/fix-intro-derniers-faits/src/types.js",
  "/previews/fix-intro-derniers-faits/styles.css",
  "/previews/fix-intro-derniers-faits/vendor/preact/compat-client.mjs",
  "/previews/fix-intro-derniers-faits/vendor/preact/compat.module.js",
  "/previews/fix-intro-derniers-faits/vendor/preact/hooks.module.js",
  "/previews/fix-intro-derniers-faits/vendor/preact/jsx-runtime.module.js",
  "/previews/fix-intro-derniers-faits/vendor/preact/preact.module.js"
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

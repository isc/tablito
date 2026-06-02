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

const CACHE = 'multiplix-' + "20260602191513"
const BASE = "/multiplix/previews/claude-cool-allen-ChrGk/"
const ASSETS = [
  "/multiplix/previews/claude-cool-allen-ChrGk/favicon.svg",
  "/multiplix/previews/claude-cool-allen-ChrGk/fonts/fonts.css",
  "/multiplix/previews/claude-cool-allen-ChrGk/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/multiplix/previews/claude-cool-allen-ChrGk/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/multiplix/previews/claude-cool-allen-ChrGk/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/multiplix/previews/claude-cool-allen-ChrGk/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/multiplix/previews/claude-cool-allen-ChrGk/icons/apple-touch-icon.png",
  "/multiplix/previews/claude-cool-allen-ChrGk/icons/icon-192.png",
  "/multiplix/previews/claude-cool-allen-ChrGk/icons/icon-512.png",
  "/multiplix/previews/claude-cool-allen-ChrGk/icons/icon.svg",
  "/multiplix/previews/claude-cool-allen-ChrGk/icons.svg",
  "/multiplix/previews/claude-cool-allen-ChrGk/index.html",
  "/multiplix/previews/claude-cool-allen-ChrGk/manifest.webmanifest",
  "/multiplix/previews/claude-cool-allen-ChrGk/specs/index.html",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/App.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/badges.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/leitner.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/parseFrenchNumber.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/placement.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/sessionComposer.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/setup.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/strategies.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/streak.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/__tests__/userJourney.test.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/assets/hero.png",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/assets/react.svg",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/assets/vite.svg",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/BackChevron.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/Badge.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/BadgeDetailModal.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/DotGrid.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/ErrorBoundary.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/EvolutionChart.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/Feather.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/FeedbackModal.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/FeedbackOverlay.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/FlameIcon.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/Mascot.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/Modal.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/MysteryImage.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/NotificationSettings.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/NumPad.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/ParentGate.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/ProgressGrid.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/StrategyHint.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/StreakDetailModal.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/components/VoiceInput.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/env.d.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useConfetti.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useInputMode.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useSound.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useSpeechRecognition.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useTTS.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/hooks/useWakeLock.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/audioContext.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/badges.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/changelog.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/facts.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/feedback.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/install.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/leitner.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/micPreflight.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/parseFrenchNumber.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/placement.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/push.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/sessionComposer.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/similarity.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/storage.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/strategies.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/streak.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/lib/utils.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/main.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/BadgesScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/ChangelogScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/HomeScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/ParentDashboard.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/PrivacyScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/ProgressScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/RecapScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/RulesIntroScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/RulesScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/SessionScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/screens/WelcomeScreen.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/src/types.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/styles.css",
  "/multiplix/previews/claude-cool-allen-ChrGk/vendor/preact/compat-client.mjs",
  "/multiplix/previews/claude-cool-allen-ChrGk/vendor/preact/compat.module.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/vendor/preact/hooks.module.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/vendor/preact/jsx-runtime.module.js",
  "/multiplix/previews/claude-cool-allen-ChrGk/vendor/preact/preact.module.js"
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
  const title = data.title || 'Multiplix'
  const body = data.body || "C'est l'heure de réviser tes tables ! 🎯"
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

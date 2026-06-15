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

const CACHE = 'tablito-' + "20260615121224"
const BASE = "/previews/docs-legende-image-mystere/"
const ASSETS = [
  "/previews/docs-legende-image-mystere/CNAME",
  "/previews/docs-legende-image-mystere/favicon.svg",
  "/previews/docs-legende-image-mystere/fonts/fonts.css",
  "/previews/docs-legende-image-mystere/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/docs-legende-image-mystere/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/docs-legende-image-mystere/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/docs-legende-image-mystere/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/docs-legende-image-mystere/icons/apple-touch-icon.png",
  "/previews/docs-legende-image-mystere/icons/icon-192.png",
  "/previews/docs-legende-image-mystere/icons/icon-512.png",
  "/previews/docs-legende-image-mystere/icons/icon.svg",
  "/previews/docs-legende-image-mystere/icons.svg",
  "/previews/docs-legende-image-mystere/index.html",
  "/previews/docs-legende-image-mystere/manifest.webmanifest",
  "/previews/docs-legende-image-mystere/specs/index.html",
  "/previews/docs-legende-image-mystere/src/App.js",
  "/previews/docs-legende-image-mystere/src/__tests__/badges.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/dailyComposer.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/divisionBadges.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/divisionComposer.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/divisionFacts.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/divisionJourney.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/dotGrid.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/leitner.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/mixedSessionTTS.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/multiProfile.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/parseEnglishNumber.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/parseFrenchNumber.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/placement.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/recapCelebrations.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/sessionComposer.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/setup.js",
  "/previews/docs-legende-image-mystere/src/__tests__/strategies.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/streak.test.js",
  "/previews/docs-legende-image-mystere/src/__tests__/userJourney.test.js",
  "/previews/docs-legende-image-mystere/src/assets/hero.png",
  "/previews/docs-legende-image-mystere/src/assets/react.svg",
  "/previews/docs-legende-image-mystere/src/assets/vite.svg",
  "/previews/docs-legende-image-mystere/src/components/BackChevron.js",
  "/previews/docs-legende-image-mystere/src/components/Badge.js",
  "/previews/docs-legende-image-mystere/src/components/BadgeDetailModal.js",
  "/previews/docs-legende-image-mystere/src/components/DivisionMysteryImage.js",
  "/previews/docs-legende-image-mystere/src/components/DivisionProgressGrid.js",
  "/previews/docs-legende-image-mystere/src/components/DivisionStrategyHint.js",
  "/previews/docs-legende-image-mystere/src/components/DotGrid.js",
  "/previews/docs-legende-image-mystere/src/components/ErrorBoundary.js",
  "/previews/docs-legende-image-mystere/src/components/EvolutionChart.js",
  "/previews/docs-legende-image-mystere/src/components/Feather.js",
  "/previews/docs-legende-image-mystere/src/components/FeedbackModal.js",
  "/previews/docs-legende-image-mystere/src/components/FeedbackOverlay.js",
  "/previews/docs-legende-image-mystere/src/components/FeedbackStar.js",
  "/previews/docs-legende-image-mystere/src/components/FlameIcon.js",
  "/previews/docs-legende-image-mystere/src/components/LanguageToggle.js",
  "/previews/docs-legende-image-mystere/src/components/LeitnerGrid.js",
  "/previews/docs-legende-image-mystere/src/components/Mascot.js",
  "/previews/docs-legende-image-mystere/src/components/Modal.js",
  "/previews/docs-legende-image-mystere/src/components/MysteryGrid.js",
  "/previews/docs-legende-image-mystere/src/components/MysteryImage.js",
  "/previews/docs-legende-image-mystere/src/components/NotificationSettings.js",
  "/previews/docs-legende-image-mystere/src/components/NumPad.js",
  "/previews/docs-legende-image-mystere/src/components/ParentGate.js",
  "/previews/docs-legende-image-mystere/src/components/ProgressGrid.js",
  "/previews/docs-legende-image-mystere/src/components/StrategyHint.js",
  "/previews/docs-legende-image-mystere/src/components/StrategyHintShell.js",
  "/previews/docs-legende-image-mystere/src/components/StreakDetailModal.js",
  "/previews/docs-legende-image-mystere/src/components/VoiceInput.js",
  "/previews/docs-legende-image-mystere/src/env.d.js",
  "/previews/docs-legende-image-mystere/src/hooks/useConfetti.js",
  "/previews/docs-legende-image-mystere/src/hooks/useInputMode.js",
  "/previews/docs-legende-image-mystere/src/hooks/useSound.js",
  "/previews/docs-legende-image-mystere/src/hooks/useSpeechRecognition.js",
  "/previews/docs-legende-image-mystere/src/hooks/useSpeechRecognition.test.js",
  "/previews/docs-legende-image-mystere/src/hooks/useTTS.js",
  "/previews/docs-legende-image-mystere/src/hooks/useWakeLock.js",
  "/previews/docs-legende-image-mystere/src/i18n/LangProvider.js",
  "/previews/docs-legende-image-mystere/src/i18n/app.js",
  "/previews/docs-legende-image-mystere/src/i18n/badges.js",
  "/previews/docs-legende-image-mystere/src/i18n/changelog.js",
  "/previews/docs-legende-image-mystere/src/i18n/home.js",
  "/previews/docs-legende-image-mystere/src/i18n/lang.js",
  "/previews/docs-legende-image-mystere/src/i18n/language.js",
  "/previews/docs-legende-image-mystere/src/i18n/onboarding.js",
  "/previews/docs-legende-image-mystere/src/i18n/parent.js",
  "/previews/docs-legende-image-mystere/src/i18n/privacy.js",
  "/previews/docs-legende-image-mystere/src/i18n/progress.js",
  "/previews/docs-legende-image-mystere/src/i18n/recap.js",
  "/previews/docs-legende-image-mystere/src/i18n/session.js",
  "/previews/docs-legende-image-mystere/src/i18n/strategies.js",
  "/previews/docs-legende-image-mystere/src/i18n/voice.js",
  "/previews/docs-legende-image-mystere/src/lib/audioContext.js",
  "/previews/docs-legende-image-mystere/src/lib/badges.js",
  "/previews/docs-legende-image-mystere/src/lib/changelog.js",
  "/previews/docs-legende-image-mystere/src/lib/dailyComposer.js",
  "/previews/docs-legende-image-mystere/src/lib/divisionComposer.js",
  "/previews/docs-legende-image-mystere/src/lib/divisionFacts.js",
  "/previews/docs-legende-image-mystere/src/lib/divisionStrategies.js",
  "/previews/docs-legende-image-mystere/src/lib/facts.js",
  "/previews/docs-legende-image-mystere/src/lib/feedback.js",
  "/previews/docs-legende-image-mystere/src/lib/hardestFacts.js",
  "/previews/docs-legende-image-mystere/src/lib/install.js",
  "/previews/docs-legende-image-mystere/src/lib/leitner.js",
  "/previews/docs-legende-image-mystere/src/lib/micPreflight.js",
  "/previews/docs-legende-image-mystere/src/lib/parseEnglishNumber.js",
  "/previews/docs-legende-image-mystere/src/lib/parseFrenchNumber.js",
  "/previews/docs-legende-image-mystere/src/lib/parseSpokenNumber.js",
  "/previews/docs-legende-image-mystere/src/lib/placement.js",
  "/previews/docs-legende-image-mystere/src/lib/push.js",
  "/previews/docs-legende-image-mystere/src/lib/sessionComposer.js",
  "/previews/docs-legende-image-mystere/src/lib/similarity.js",
  "/previews/docs-legende-image-mystere/src/lib/spokenNumber.js",
  "/previews/docs-legende-image-mystere/src/lib/storage.js",
  "/previews/docs-legende-image-mystere/src/lib/strategies.js",
  "/previews/docs-legende-image-mystere/src/lib/streak.js",
  "/previews/docs-legende-image-mystere/src/lib/utils.js",
  "/previews/docs-legende-image-mystere/src/main.js",
  "/previews/docs-legende-image-mystere/src/screens/BadgesScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/ChangelogScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/HomeScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/ParentDashboard.js",
  "/previews/docs-legende-image-mystere/src/screens/PrivacyScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/ProfileSelectScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/ProgressScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/RecapScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/RulesIntroScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/RulesScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/SessionScreen.js",
  "/previews/docs-legende-image-mystere/src/screens/WelcomeScreen.js",
  "/previews/docs-legende-image-mystere/src/types.js",
  "/previews/docs-legende-image-mystere/styles.css",
  "/previews/docs-legende-image-mystere/vendor/preact/compat-client.mjs",
  "/previews/docs-legende-image-mystere/vendor/preact/compat.module.js",
  "/previews/docs-legende-image-mystere/vendor/preact/hooks.module.js",
  "/previews/docs-legende-image-mystere/vendor/preact/jsx-runtime.module.js",
  "/previews/docs-legende-image-mystere/vendor/preact/preact.module.js"
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

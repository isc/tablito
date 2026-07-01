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

const CACHE = 'tablito-' + "20260701055846"
const BASE = "/previews/fix-division-badge-visuals/"
const ASSETS = [
  "/previews/fix-division-badge-visuals/CNAME",
  "/previews/fix-division-badge-visuals/favicon.svg",
  "/previews/fix-division-badge-visuals/fonts/fonts.css",
  "/previews/fix-division-badge-visuals/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/fix-division-badge-visuals/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/fix-division-badge-visuals/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/fix-division-badge-visuals/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/fix-division-badge-visuals/icons/apple-touch-icon.png",
  "/previews/fix-division-badge-visuals/icons/icon-192.png",
  "/previews/fix-division-badge-visuals/icons/icon-512.png",
  "/previews/fix-division-badge-visuals/icons/icon.svg",
  "/previews/fix-division-badge-visuals/icons.svg",
  "/previews/fix-division-badge-visuals/index.html",
  "/previews/fix-division-badge-visuals/manifest.en.webmanifest",
  "/previews/fix-division-badge-visuals/manifest.webmanifest",
  "/previews/fix-division-badge-visuals/specs/index.html",
  "/previews/fix-division-badge-visuals/src/App.js",
  "/previews/fix-division-badge-visuals/src/__tests__/badges.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/dailyComposer.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/divisionBadges.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/divisionComposer.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/divisionFacts.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/divisionJourney.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/dotGrid.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/leitner.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/mixedSessionTTS.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/multiProfile.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/parseEnglishNumber.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/parseFrenchNumber.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/placement.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/recapCelebrations.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/sessionComposer.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/setup.js",
  "/previews/fix-division-badge-visuals/src/__tests__/strategies.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/streak.test.js",
  "/previews/fix-division-badge-visuals/src/__tests__/userJourney.test.js",
  "/previews/fix-division-badge-visuals/src/assets/hero.png",
  "/previews/fix-division-badge-visuals/src/assets/react.svg",
  "/previews/fix-division-badge-visuals/src/assets/vite.svg",
  "/previews/fix-division-badge-visuals/src/components/BackChevron.js",
  "/previews/fix-division-badge-visuals/src/components/Badge.js",
  "/previews/fix-division-badge-visuals/src/components/BadgeDetailModal.js",
  "/previews/fix-division-badge-visuals/src/components/DivisionMysteryImage.js",
  "/previews/fix-division-badge-visuals/src/components/DivisionProgressGrid.js",
  "/previews/fix-division-badge-visuals/src/components/DivisionStrategyHint.js",
  "/previews/fix-division-badge-visuals/src/components/DotGrid.js",
  "/previews/fix-division-badge-visuals/src/components/ErrorBoundary.js",
  "/previews/fix-division-badge-visuals/src/components/EvolutionChart.js",
  "/previews/fix-division-badge-visuals/src/components/Feather.js",
  "/previews/fix-division-badge-visuals/src/components/FeedbackModal.js",
  "/previews/fix-division-badge-visuals/src/components/FeedbackOverlay.js",
  "/previews/fix-division-badge-visuals/src/components/FeedbackStar.js",
  "/previews/fix-division-badge-visuals/src/components/FlameIcon.js",
  "/previews/fix-division-badge-visuals/src/components/LanguageToggle.js",
  "/previews/fix-division-badge-visuals/src/components/LeitnerGrid.js",
  "/previews/fix-division-badge-visuals/src/components/Mascot.js",
  "/previews/fix-division-badge-visuals/src/components/Modal.js",
  "/previews/fix-division-badge-visuals/src/components/MysteryGrid.js",
  "/previews/fix-division-badge-visuals/src/components/MysteryImage.js",
  "/previews/fix-division-badge-visuals/src/components/NotificationSettings.js",
  "/previews/fix-division-badge-visuals/src/components/NumPad.js",
  "/previews/fix-division-badge-visuals/src/components/ParentGate.js",
  "/previews/fix-division-badge-visuals/src/components/ProgressGrid.js",
  "/previews/fix-division-badge-visuals/src/components/StrategyHint.js",
  "/previews/fix-division-badge-visuals/src/components/StrategyHintShell.js",
  "/previews/fix-division-badge-visuals/src/components/StreakDetailModal.js",
  "/previews/fix-division-badge-visuals/src/components/VoiceInput.js",
  "/previews/fix-division-badge-visuals/src/env.d.js",
  "/previews/fix-division-badge-visuals/src/hooks/useConfetti.js",
  "/previews/fix-division-badge-visuals/src/hooks/useInputMode.js",
  "/previews/fix-division-badge-visuals/src/hooks/useSound.js",
  "/previews/fix-division-badge-visuals/src/hooks/useSpeechRecognition.js",
  "/previews/fix-division-badge-visuals/src/hooks/useSpeechRecognition.test.js",
  "/previews/fix-division-badge-visuals/src/hooks/useTTS.js",
  "/previews/fix-division-badge-visuals/src/hooks/useWakeLock.js",
  "/previews/fix-division-badge-visuals/src/i18n/LangProvider.js",
  "/previews/fix-division-badge-visuals/src/i18n/app.js",
  "/previews/fix-division-badge-visuals/src/i18n/badges.js",
  "/previews/fix-division-badge-visuals/src/i18n/changelog.js",
  "/previews/fix-division-badge-visuals/src/i18n/home.js",
  "/previews/fix-division-badge-visuals/src/i18n/lang.js",
  "/previews/fix-division-badge-visuals/src/i18n/language.js",
  "/previews/fix-division-badge-visuals/src/i18n/onboarding.js",
  "/previews/fix-division-badge-visuals/src/i18n/parent.js",
  "/previews/fix-division-badge-visuals/src/i18n/privacy.js",
  "/previews/fix-division-badge-visuals/src/i18n/progress.js",
  "/previews/fix-division-badge-visuals/src/i18n/recap.js",
  "/previews/fix-division-badge-visuals/src/i18n/session.js",
  "/previews/fix-division-badge-visuals/src/i18n/strategies.js",
  "/previews/fix-division-badge-visuals/src/i18n/voice.js",
  "/previews/fix-division-badge-visuals/src/lib/audioContext.js",
  "/previews/fix-division-badge-visuals/src/lib/badges.js",
  "/previews/fix-division-badge-visuals/src/lib/changelog.js",
  "/previews/fix-division-badge-visuals/src/lib/dailyComposer.js",
  "/previews/fix-division-badge-visuals/src/lib/divisionComposer.js",
  "/previews/fix-division-badge-visuals/src/lib/divisionFacts.js",
  "/previews/fix-division-badge-visuals/src/lib/divisionStrategies.js",
  "/previews/fix-division-badge-visuals/src/lib/facts.js",
  "/previews/fix-division-badge-visuals/src/lib/feedback.js",
  "/previews/fix-division-badge-visuals/src/lib/hardestFacts.js",
  "/previews/fix-division-badge-visuals/src/lib/install.js",
  "/previews/fix-division-badge-visuals/src/lib/leitner.js",
  "/previews/fix-division-badge-visuals/src/lib/micPreflight.js",
  "/previews/fix-division-badge-visuals/src/lib/parseEnglishNumber.js",
  "/previews/fix-division-badge-visuals/src/lib/parseFrenchNumber.js",
  "/previews/fix-division-badge-visuals/src/lib/parseSpokenNumber.js",
  "/previews/fix-division-badge-visuals/src/lib/placement.js",
  "/previews/fix-division-badge-visuals/src/lib/push.js",
  "/previews/fix-division-badge-visuals/src/lib/sessionComposer.js",
  "/previews/fix-division-badge-visuals/src/lib/similarity.js",
  "/previews/fix-division-badge-visuals/src/lib/spokenNumber.js",
  "/previews/fix-division-badge-visuals/src/lib/storage.js",
  "/previews/fix-division-badge-visuals/src/lib/strategies.js",
  "/previews/fix-division-badge-visuals/src/lib/streak.js",
  "/previews/fix-division-badge-visuals/src/lib/utils.js",
  "/previews/fix-division-badge-visuals/src/main.js",
  "/previews/fix-division-badge-visuals/src/screens/BadgesScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/ChangelogScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/HomeScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/ParentDashboard.js",
  "/previews/fix-division-badge-visuals/src/screens/PrivacyScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/ProfileSelectScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/ProgressScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/RecapScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/RulesIntroScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/RulesScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/SessionScreen.js",
  "/previews/fix-division-badge-visuals/src/screens/WelcomeScreen.js",
  "/previews/fix-division-badge-visuals/src/types.js",
  "/previews/fix-division-badge-visuals/styles.css",
  "/previews/fix-division-badge-visuals/vendor/preact/compat-client.mjs",
  "/previews/fix-division-badge-visuals/vendor/preact/compat.module.js",
  "/previews/fix-division-badge-visuals/vendor/preact/hooks.module.js",
  "/previews/fix-division-badge-visuals/vendor/preact/jsx-runtime.module.js",
  "/previews/fix-division-badge-visuals/vendor/preact/preact.module.js"
]

// Précache tolérant aux échecs. `cache.addAll()` est ATOMIQUE : un seul asset
// qui échoue à se télécharger (fréquent sur WiFi faible — l'environnement où le
// cache offline est justement le plus utile) rejette TOUT le précache, l'install
// échoue, et l'appareil reste sans cache pour cette version. On cache donc asset
// par asset : ce qui passe est gardé, le reste sera lazy-caché à la 1re requête
// réseau réussie (cf. fetch handler). L'install réussit toujours.
function precache() {
  return caches.open(CACHE).then((c) =>
    Promise.allSettled(ASSETS.map((a) => c.add(a)))
  )
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()))
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

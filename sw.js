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

const CACHE = 'tablito-' + "20260618193659"
const BASE = "/"
const ASSETS = [
  "/CNAME",
  "/favicon.svg",
  "/fonts/fonts.css",
  "/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/icons.svg",
  "/index.html",
  "/manifest.en.webmanifest",
  "/manifest.webmanifest",
  "/specs/index.html",
  "/src/App.js",
  "/src/__tests__/badges.test.js",
  "/src/__tests__/dailyComposer.test.js",
  "/src/__tests__/divisionBadges.test.js",
  "/src/__tests__/divisionComposer.test.js",
  "/src/__tests__/divisionFacts.test.js",
  "/src/__tests__/divisionJourney.test.js",
  "/src/__tests__/dotGrid.test.js",
  "/src/__tests__/leitner.test.js",
  "/src/__tests__/mixedSessionTTS.test.js",
  "/src/__tests__/multiProfile.test.js",
  "/src/__tests__/parseEnglishNumber.test.js",
  "/src/__tests__/parseFrenchNumber.test.js",
  "/src/__tests__/placement.test.js",
  "/src/__tests__/recapCelebrations.test.js",
  "/src/__tests__/sessionComposer.test.js",
  "/src/__tests__/setup.js",
  "/src/__tests__/strategies.test.js",
  "/src/__tests__/streak.test.js",
  "/src/__tests__/userJourney.test.js",
  "/src/assets/hero.png",
  "/src/assets/react.svg",
  "/src/assets/vite.svg",
  "/src/components/BackChevron.js",
  "/src/components/Badge.js",
  "/src/components/BadgeDetailModal.js",
  "/src/components/DivisionMysteryImage.js",
  "/src/components/DivisionProgressGrid.js",
  "/src/components/DivisionStrategyHint.js",
  "/src/components/DotGrid.js",
  "/src/components/ErrorBoundary.js",
  "/src/components/EvolutionChart.js",
  "/src/components/Feather.js",
  "/src/components/FeedbackModal.js",
  "/src/components/FeedbackOverlay.js",
  "/src/components/FeedbackStar.js",
  "/src/components/FlameIcon.js",
  "/src/components/LanguageToggle.js",
  "/src/components/LeitnerGrid.js",
  "/src/components/Mascot.js",
  "/src/components/Modal.js",
  "/src/components/MysteryGrid.js",
  "/src/components/MysteryImage.js",
  "/src/components/NotificationSettings.js",
  "/src/components/NumPad.js",
  "/src/components/ParentGate.js",
  "/src/components/ProgressGrid.js",
  "/src/components/StrategyHint.js",
  "/src/components/StrategyHintShell.js",
  "/src/components/StreakDetailModal.js",
  "/src/components/VoiceInput.js",
  "/src/env.d.js",
  "/src/hooks/useConfetti.js",
  "/src/hooks/useInputMode.js",
  "/src/hooks/useSound.js",
  "/src/hooks/useSpeechRecognition.js",
  "/src/hooks/useSpeechRecognition.test.js",
  "/src/hooks/useTTS.js",
  "/src/hooks/useWakeLock.js",
  "/src/i18n/LangProvider.js",
  "/src/i18n/app.js",
  "/src/i18n/badges.js",
  "/src/i18n/changelog.js",
  "/src/i18n/home.js",
  "/src/i18n/lang.js",
  "/src/i18n/language.js",
  "/src/i18n/onboarding.js",
  "/src/i18n/parent.js",
  "/src/i18n/privacy.js",
  "/src/i18n/progress.js",
  "/src/i18n/recap.js",
  "/src/i18n/session.js",
  "/src/i18n/strategies.js",
  "/src/i18n/voice.js",
  "/src/lib/audioContext.js",
  "/src/lib/badges.js",
  "/src/lib/changelog.js",
  "/src/lib/dailyComposer.js",
  "/src/lib/divisionComposer.js",
  "/src/lib/divisionFacts.js",
  "/src/lib/divisionStrategies.js",
  "/src/lib/facts.js",
  "/src/lib/feedback.js",
  "/src/lib/hardestFacts.js",
  "/src/lib/install.js",
  "/src/lib/leitner.js",
  "/src/lib/micPreflight.js",
  "/src/lib/parseEnglishNumber.js",
  "/src/lib/parseFrenchNumber.js",
  "/src/lib/parseSpokenNumber.js",
  "/src/lib/placement.js",
  "/src/lib/push.js",
  "/src/lib/sessionComposer.js",
  "/src/lib/similarity.js",
  "/src/lib/spokenNumber.js",
  "/src/lib/storage.js",
  "/src/lib/strategies.js",
  "/src/lib/streak.js",
  "/src/lib/utils.js",
  "/src/main.js",
  "/src/screens/BadgesScreen.js",
  "/src/screens/ChangelogScreen.js",
  "/src/screens/HomeScreen.js",
  "/src/screens/ParentDashboard.js",
  "/src/screens/PrivacyScreen.js",
  "/src/screens/ProfileSelectScreen.js",
  "/src/screens/ProgressScreen.js",
  "/src/screens/RecapScreen.js",
  "/src/screens/RulesIntroScreen.js",
  "/src/screens/RulesScreen.js",
  "/src/screens/SessionScreen.js",
  "/src/screens/WelcomeScreen.js",
  "/src/types.js",
  "/styles.css",
  "/vendor/preact/compat-client.mjs",
  "/vendor/preact/compat.module.js",
  "/vendor/preact/hooks.module.js",
  "/vendor/preact/jsx-runtime.module.js",
  "/vendor/preact/preact.module.js"
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

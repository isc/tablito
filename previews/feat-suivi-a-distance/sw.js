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

const CACHE = 'tablito-' + "20260725124337"
const BASE = "/previews/feat-suivi-a-distance/"
const ASSETS = [
  "/previews/feat-suivi-a-distance/CNAME",
  "/previews/feat-suivi-a-distance/favicon.svg",
  "/previews/feat-suivi-a-distance/fonts/fonts.css",
  "/previews/feat-suivi-a-distance/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/feat-suivi-a-distance/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/feat-suivi-a-distance/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/feat-suivi-a-distance/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/feat-suivi-a-distance/icons/apple-touch-icon.png",
  "/previews/feat-suivi-a-distance/icons/icon-192.png",
  "/previews/feat-suivi-a-distance/icons/icon-512.png",
  "/previews/feat-suivi-a-distance/icons/icon.svg",
  "/previews/feat-suivi-a-distance/icons.svg",
  "/previews/feat-suivi-a-distance/index.html",
  "/previews/feat-suivi-a-distance/manifest.en.webmanifest",
  "/previews/feat-suivi-a-distance/manifest.webmanifest",
  "/previews/feat-suivi-a-distance/specs/index.html",
  "/previews/feat-suivi-a-distance/src/App.js",
  "/previews/feat-suivi-a-distance/src/__tests__/badges.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/dailyComposer.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/divisionBadges.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/divisionComposer.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/divisionFacts.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/divisionJourney.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/dotGrid.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/hardestFacts.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/helpers/watchServer.js",
  "/previews/feat-suivi-a-distance/src/__tests__/leitner.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/mixedSessionTTS.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/multiProfile.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/parseEnglishNumber.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/parseFrenchNumber.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/placement.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/recapCelebrations.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/remainderBadges.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/remainderComposer.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/remainderDaily.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/remainderJourney.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/remoteFollow.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/sessionComposer.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/setup.js",
  "/previews/feat-suivi-a-distance/src/__tests__/strategies.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/streak.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/transfer.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/userJourney.test.js",
  "/previews/feat-suivi-a-distance/src/__tests__/watch.test.js",
  "/previews/feat-suivi-a-distance/src/assets/hero.png",
  "/previews/feat-suivi-a-distance/src/assets/react.svg",
  "/previews/feat-suivi-a-distance/src/assets/vite.svg",
  "/previews/feat-suivi-a-distance/src/components/BackChevron.js",
  "/previews/feat-suivi-a-distance/src/components/Badge.js",
  "/previews/feat-suivi-a-distance/src/components/BadgeDetailModal.js",
  "/previews/feat-suivi-a-distance/src/components/DivisionMysteryImage.js",
  "/previews/feat-suivi-a-distance/src/components/DivisionProgressGrid.js",
  "/previews/feat-suivi-a-distance/src/components/DivisionStrategyHint.js",
  "/previews/feat-suivi-a-distance/src/components/DotGrid.js",
  "/previews/feat-suivi-a-distance/src/components/ErrorBoundary.js",
  "/previews/feat-suivi-a-distance/src/components/EvolutionChart.js",
  "/previews/feat-suivi-a-distance/src/components/Feather.js",
  "/previews/feat-suivi-a-distance/src/components/FeedbackModal.js",
  "/previews/feat-suivi-a-distance/src/components/FeedbackOverlay.js",
  "/previews/feat-suivi-a-distance/src/components/FeedbackStar.js",
  "/previews/feat-suivi-a-distance/src/components/FlameIcon.js",
  "/previews/feat-suivi-a-distance/src/components/LanguageToggle.js",
  "/previews/feat-suivi-a-distance/src/components/LeitnerGrid.js",
  "/previews/feat-suivi-a-distance/src/components/Mascot.js",
  "/previews/feat-suivi-a-distance/src/components/Modal.js",
  "/previews/feat-suivi-a-distance/src/components/MysteryGrid.js",
  "/previews/feat-suivi-a-distance/src/components/MysteryImage.js",
  "/previews/feat-suivi-a-distance/src/components/NotificationSettings.js",
  "/previews/feat-suivi-a-distance/src/components/NumPad.js",
  "/previews/feat-suivi-a-distance/src/components/ParentGate.js",
  "/previews/feat-suivi-a-distance/src/components/ParentStats.js",
  "/previews/feat-suivi-a-distance/src/components/ProgressGrid.js",
  "/previews/feat-suivi-a-distance/src/components/QrCanvas.js",
  "/previews/feat-suivi-a-distance/src/components/RemainderMysteryImage.js",
  "/previews/feat-suivi-a-distance/src/components/RemainderProgressGrid.js",
  "/previews/feat-suivi-a-distance/src/components/RemainderStrategyHint.js",
  "/previews/feat-suivi-a-distance/src/components/StrategyHint.js",
  "/previews/feat-suivi-a-distance/src/components/StrategyHintShell.js",
  "/previews/feat-suivi-a-distance/src/components/StreakDetailModal.js",
  "/previews/feat-suivi-a-distance/src/components/VoiceInput.js",
  "/previews/feat-suivi-a-distance/src/components/VoiceInput.test.js",
  "/previews/feat-suivi-a-distance/src/env.d.js",
  "/previews/feat-suivi-a-distance/src/hooks/useConfetti.js",
  "/previews/feat-suivi-a-distance/src/hooks/useInputMode.js",
  "/previews/feat-suivi-a-distance/src/hooks/useQrScan.js",
  "/previews/feat-suivi-a-distance/src/hooks/useSound.js",
  "/previews/feat-suivi-a-distance/src/hooks/useSpeechRecognition.js",
  "/previews/feat-suivi-a-distance/src/hooks/useSpeechRecognition.test.js",
  "/previews/feat-suivi-a-distance/src/hooks/useTTS.js",
  "/previews/feat-suivi-a-distance/src/hooks/useWakeLock.js",
  "/previews/feat-suivi-a-distance/src/i18n/LangProvider.js",
  "/previews/feat-suivi-a-distance/src/i18n/app.js",
  "/previews/feat-suivi-a-distance/src/i18n/badges.js",
  "/previews/feat-suivi-a-distance/src/i18n/changelog.js",
  "/previews/feat-suivi-a-distance/src/i18n/home.js",
  "/previews/feat-suivi-a-distance/src/i18n/lang.js",
  "/previews/feat-suivi-a-distance/src/i18n/language.js",
  "/previews/feat-suivi-a-distance/src/i18n/onboarding.js",
  "/previews/feat-suivi-a-distance/src/i18n/parent.js",
  "/previews/feat-suivi-a-distance/src/i18n/privacy.js",
  "/previews/feat-suivi-a-distance/src/i18n/progress.js",
  "/previews/feat-suivi-a-distance/src/i18n/recap.js",
  "/previews/feat-suivi-a-distance/src/i18n/session.js",
  "/previews/feat-suivi-a-distance/src/i18n/strategies.js",
  "/previews/feat-suivi-a-distance/src/i18n/voice.js",
  "/previews/feat-suivi-a-distance/src/lib/audioContext.js",
  "/previews/feat-suivi-a-distance/src/lib/badges.js",
  "/previews/feat-suivi-a-distance/src/lib/changelog.js",
  "/previews/feat-suivi-a-distance/src/lib/codec.js",
  "/previews/feat-suivi-a-distance/src/lib/dailyComposer.js",
  "/previews/feat-suivi-a-distance/src/lib/debugTools.js",
  "/previews/feat-suivi-a-distance/src/lib/divisionComposer.js",
  "/previews/feat-suivi-a-distance/src/lib/divisionFacts.js",
  "/previews/feat-suivi-a-distance/src/lib/divisionStrategies.js",
  "/previews/feat-suivi-a-distance/src/lib/facts.js",
  "/previews/feat-suivi-a-distance/src/lib/feedback.js",
  "/previews/feat-suivi-a-distance/src/lib/hardestFacts.js",
  "/previews/feat-suivi-a-distance/src/lib/install.js",
  "/previews/feat-suivi-a-distance/src/lib/leitner.js",
  "/previews/feat-suivi-a-distance/src/lib/micPreflight.js",
  "/previews/feat-suivi-a-distance/src/lib/parseEnglishNumber.js",
  "/previews/feat-suivi-a-distance/src/lib/parseFrenchNumber.js",
  "/previews/feat-suivi-a-distance/src/lib/parseSpokenNumber.js",
  "/previews/feat-suivi-a-distance/src/lib/placement.js",
  "/previews/feat-suivi-a-distance/src/lib/push.js",
  "/previews/feat-suivi-a-distance/src/lib/remainderComposer.js",
  "/previews/feat-suivi-a-distance/src/lib/remainderFacts.js",
  "/previews/feat-suivi-a-distance/src/lib/remainderStrategies.js",
  "/previews/feat-suivi-a-distance/src/lib/sessionComposer.js",
  "/previews/feat-suivi-a-distance/src/lib/sessionItemView.js",
  "/previews/feat-suivi-a-distance/src/lib/similarity.js",
  "/previews/feat-suivi-a-distance/src/lib/spokenNumber.js",
  "/previews/feat-suivi-a-distance/src/lib/storage.js",
  "/previews/feat-suivi-a-distance/src/lib/strategies.js",
  "/previews/feat-suivi-a-distance/src/lib/streak.js",
  "/previews/feat-suivi-a-distance/src/lib/supabase.js",
  "/previews/feat-suivi-a-distance/src/lib/transfer.js",
  "/previews/feat-suivi-a-distance/src/lib/utils.js",
  "/previews/feat-suivi-a-distance/src/lib/voiceDebug.js",
  "/previews/feat-suivi-a-distance/src/lib/watch.js",
  "/previews/feat-suivi-a-distance/src/lib/watchStore.js",
  "/previews/feat-suivi-a-distance/src/main.js",
  "/previews/feat-suivi-a-distance/src/screens/BadgesScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/ChangelogScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/HomeScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/ParentDashboard.js",
  "/previews/feat-suivi-a-distance/src/screens/PrivacyScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/ProfileSelectScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/ProgressScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/RecapScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/RulesIntroScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/RulesScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/SessionScreen.js",
  "/previews/feat-suivi-a-distance/src/screens/WelcomeScreen.js",
  "/previews/feat-suivi-a-distance/src/types.js",
  "/previews/feat-suivi-a-distance/styles.css",
  "/previews/feat-suivi-a-distance/vendor/lean-qr/index.mjs",
  "/previews/feat-suivi-a-distance/vendor/preact/compat-client.mjs",
  "/previews/feat-suivi-a-distance/vendor/preact/compat.module.js",
  "/previews/feat-suivi-a-distance/vendor/preact/hooks.module.js",
  "/previews/feat-suivi-a-distance/vendor/preact/jsx-runtime.module.js",
  "/previews/feat-suivi-a-distance/vendor/preact/preact.module.js"
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

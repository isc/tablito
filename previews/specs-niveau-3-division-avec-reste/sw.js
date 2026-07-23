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

const CACHE = 'tablito-' + "20260723211653"
const BASE = "/previews/specs-niveau-3-division-avec-reste/"
const ASSETS = [
  "/previews/specs-niveau-3-division-avec-reste/CNAME",
  "/previews/specs-niveau-3-division-avec-reste/favicon.svg",
  "/previews/specs-niveau-3-division-avec-reste/fonts/fonts.css",
  "/previews/specs-niveau-3-division-avec-reste/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/specs-niveau-3-division-avec-reste/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/specs-niveau-3-division-avec-reste/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/specs-niveau-3-division-avec-reste/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/specs-niveau-3-division-avec-reste/icons/apple-touch-icon.png",
  "/previews/specs-niveau-3-division-avec-reste/icons/icon-192.png",
  "/previews/specs-niveau-3-division-avec-reste/icons/icon-512.png",
  "/previews/specs-niveau-3-division-avec-reste/icons/icon.svg",
  "/previews/specs-niveau-3-division-avec-reste/icons.svg",
  "/previews/specs-niveau-3-division-avec-reste/index.html",
  "/previews/specs-niveau-3-division-avec-reste/manifest.en.webmanifest",
  "/previews/specs-niveau-3-division-avec-reste/manifest.webmanifest",
  "/previews/specs-niveau-3-division-avec-reste/specs/index.html",
  "/previews/specs-niveau-3-division-avec-reste/src/App.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/badges.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/dailyComposer.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/divisionBadges.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/divisionComposer.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/divisionFacts.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/divisionJourney.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/dotGrid.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/hardestFacts.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/leitner.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/mixedSessionTTS.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/multiProfile.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/parseEnglishNumber.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/parseFrenchNumber.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/placement.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/recapCelebrations.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/remainderBadges.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/remainderComposer.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/remainderDaily.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/remainderJourney.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/sessionComposer.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/setup.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/strategies.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/streak.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/transfer.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/__tests__/userJourney.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/assets/hero.png",
  "/previews/specs-niveau-3-division-avec-reste/src/assets/react.svg",
  "/previews/specs-niveau-3-division-avec-reste/src/assets/vite.svg",
  "/previews/specs-niveau-3-division-avec-reste/src/components/BackChevron.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/Badge.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/BadgeDetailModal.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/DivisionMysteryImage.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/DivisionProgressGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/DivisionStrategyHint.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/DotGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/ErrorBoundary.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/EvolutionChart.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/Feather.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/FeedbackModal.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/FeedbackOverlay.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/FeedbackStar.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/FlameIcon.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/LanguageToggle.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/LeitnerGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/Mascot.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/Modal.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/MysteryGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/MysteryImage.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/NotificationSettings.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/NumPad.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/ParentGate.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/ProgressGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/RemainderMysteryImage.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/RemainderProgressGrid.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/RemainderStrategyHint.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/StrategyHint.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/StrategyHintShell.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/StreakDetailModal.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/VoiceInput.js",
  "/previews/specs-niveau-3-division-avec-reste/src/components/VoiceInput.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/env.d.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useConfetti.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useInputMode.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useSound.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useSpeechRecognition.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useSpeechRecognition.test.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useTTS.js",
  "/previews/specs-niveau-3-division-avec-reste/src/hooks/useWakeLock.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/LangProvider.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/app.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/badges.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/changelog.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/home.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/lang.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/language.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/onboarding.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/parent.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/privacy.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/progress.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/recap.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/session.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/strategies.js",
  "/previews/specs-niveau-3-division-avec-reste/src/i18n/voice.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/audioContext.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/badges.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/changelog.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/codec.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/dailyComposer.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/debugTools.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/divisionComposer.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/divisionFacts.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/divisionStrategies.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/facts.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/feedback.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/hardestFacts.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/install.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/leitner.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/micPreflight.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/parseEnglishNumber.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/parseFrenchNumber.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/parseSpokenNumber.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/placement.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/push.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/remainderComposer.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/remainderFacts.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/remainderStrategies.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/sessionComposer.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/sessionItemView.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/similarity.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/spokenNumber.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/storage.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/strategies.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/streak.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/supabase.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/transfer.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/utils.js",
  "/previews/specs-niveau-3-division-avec-reste/src/lib/voiceDebug.js",
  "/previews/specs-niveau-3-division-avec-reste/src/main.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/BadgesScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/ChangelogScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/HomeScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/ParentDashboard.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/PrivacyScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/ProfileSelectScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/ProgressScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/RecapScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/RulesIntroScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/RulesScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/SessionScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/screens/WelcomeScreen.js",
  "/previews/specs-niveau-3-division-avec-reste/src/types.js",
  "/previews/specs-niveau-3-division-avec-reste/styles.css",
  "/previews/specs-niveau-3-division-avec-reste/vendor/lean-qr/index.mjs",
  "/previews/specs-niveau-3-division-avec-reste/vendor/preact/compat-client.mjs",
  "/previews/specs-niveau-3-division-avec-reste/vendor/preact/compat.module.js",
  "/previews/specs-niveau-3-division-avec-reste/vendor/preact/hooks.module.js",
  "/previews/specs-niveau-3-division-avec-reste/vendor/preact/jsx-runtime.module.js",
  "/previews/specs-niveau-3-division-avec-reste/vendor/preact/preact.module.js"
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

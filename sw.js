// Service Worker minimal.
//
// Stratégie :
//  - install : precache du shell (HTML, JS, CSS, vendor, icônes — pas
//    les médias lourds qui sont chargés à la demande).
//  - navigation : network-first puis fallback vers index.html cachée
//    (pattern SPA standard, fait que toute URL marche offline).
//  - autre GET : cache-first puis lazy-cache si succès réseau.
//
// Les marqueurs de version, de base path et de liste d'assets sont
// substitués par scripts/build.mjs.

const CACHE = 'multiplix-' + "20260508162604"
const BASE = "/multiplix/"
const ASSETS = [
  "/multiplix/favicon.svg",
  "/multiplix/icons/apple-touch-icon.png",
  "/multiplix/icons/icon-192.png",
  "/multiplix/icons/icon-512.png",
  "/multiplix/icons/icon.svg",
  "/multiplix/icons.svg",
  "/multiplix/index.html",
  "/multiplix/src/App.css",
  "/multiplix/src/App.css.js",
  "/multiplix/src/App.js",
  "/multiplix/src/__tests__/badges.test.js",
  "/multiplix/src/__tests__/leitner.test.js",
  "/multiplix/src/__tests__/parseFrenchNumber.test.js",
  "/multiplix/src/__tests__/placement.test.js",
  "/multiplix/src/__tests__/sessionComposer.test.js",
  "/multiplix/src/__tests__/setup.js",
  "/multiplix/src/__tests__/strategies.test.js",
  "/multiplix/src/__tests__/streak.test.js",
  "/multiplix/src/__tests__/userJourney.test.js",
  "/multiplix/src/assets/hero.png",
  "/multiplix/src/assets/react.svg",
  "/multiplix/src/assets/vite.svg",
  "/multiplix/src/components/BackChevron.js",
  "/multiplix/src/components/Badge.css",
  "/multiplix/src/components/Badge.css.js",
  "/multiplix/src/components/Badge.js",
  "/multiplix/src/components/BadgeDetailModal.css",
  "/multiplix/src/components/BadgeDetailModal.css.js",
  "/multiplix/src/components/BadgeDetailModal.js",
  "/multiplix/src/components/DotGrid.css",
  "/multiplix/src/components/DotGrid.css.js",
  "/multiplix/src/components/DotGrid.js",
  "/multiplix/src/components/ErrorBoundary.css",
  "/multiplix/src/components/ErrorBoundary.css.js",
  "/multiplix/src/components/ErrorBoundary.js",
  "/multiplix/src/components/FeedbackModal.css",
  "/multiplix/src/components/FeedbackModal.css.js",
  "/multiplix/src/components/FeedbackModal.js",
  "/multiplix/src/components/FeedbackOverlay.css",
  "/multiplix/src/components/FeedbackOverlay.css.js",
  "/multiplix/src/components/FeedbackOverlay.js",
  "/multiplix/src/components/FlameIcon.js",
  "/multiplix/src/components/IOSInstallModal.css",
  "/multiplix/src/components/IOSInstallModal.css.js",
  "/multiplix/src/components/IOSInstallModal.js",
  "/multiplix/src/components/Mascot.css",
  "/multiplix/src/components/Mascot.css.js",
  "/multiplix/src/components/Mascot.js",
  "/multiplix/src/components/Modal.css",
  "/multiplix/src/components/Modal.css.js",
  "/multiplix/src/components/Modal.js",
  "/multiplix/src/components/MysteryImage.css",
  "/multiplix/src/components/MysteryImage.css.js",
  "/multiplix/src/components/MysteryImage.js",
  "/multiplix/src/components/NumPad.css",
  "/multiplix/src/components/NumPad.css.js",
  "/multiplix/src/components/NumPad.js",
  "/multiplix/src/components/ParentGate.css",
  "/multiplix/src/components/ParentGate.css.js",
  "/multiplix/src/components/ParentGate.js",
  "/multiplix/src/components/ProgressGrid.css",
  "/multiplix/src/components/ProgressGrid.css.js",
  "/multiplix/src/components/ProgressGrid.js",
  "/multiplix/src/components/StrategyHint.css",
  "/multiplix/src/components/StrategyHint.css.js",
  "/multiplix/src/components/StrategyHint.js",
  "/multiplix/src/components/StreakDetailModal.css",
  "/multiplix/src/components/StreakDetailModal.css.js",
  "/multiplix/src/components/StreakDetailModal.js",
  "/multiplix/src/components/VoiceInput.css",
  "/multiplix/src/components/VoiceInput.css.js",
  "/multiplix/src/components/VoiceInput.js",
  "/multiplix/src/env.d.js",
  "/multiplix/src/hooks/useConfetti.js",
  "/multiplix/src/hooks/useInputMode.js",
  "/multiplix/src/hooks/useInstallPrompt.js",
  "/multiplix/src/hooks/useSound.js",
  "/multiplix/src/hooks/useSpeechRecognition.js",
  "/multiplix/src/hooks/useTTS.js",
  "/multiplix/src/hooks/useWakeLock.js",
  "/multiplix/src/index.css",
  "/multiplix/src/index.css.js",
  "/multiplix/src/lib/audioContext.js",
  "/multiplix/src/lib/badges.js",
  "/multiplix/src/lib/changelog.js",
  "/multiplix/src/lib/facts.js",
  "/multiplix/src/lib/feedback.js",
  "/multiplix/src/lib/install.js",
  "/multiplix/src/lib/leitner.js",
  "/multiplix/src/lib/micPreflight.js",
  "/multiplix/src/lib/parseFrenchNumber.js",
  "/multiplix/src/lib/placement.js",
  "/multiplix/src/lib/sessionComposer.js",
  "/multiplix/src/lib/similarity.js",
  "/multiplix/src/lib/storage.js",
  "/multiplix/src/lib/strategies.js",
  "/multiplix/src/lib/streak.js",
  "/multiplix/src/lib/utils.js",
  "/multiplix/src/main.js",
  "/multiplix/src/screens/BadgesScreen.css",
  "/multiplix/src/screens/BadgesScreen.css.js",
  "/multiplix/src/screens/BadgesScreen.js",
  "/multiplix/src/screens/ChangelogScreen.css",
  "/multiplix/src/screens/ChangelogScreen.css.js",
  "/multiplix/src/screens/ChangelogScreen.js",
  "/multiplix/src/screens/HomeScreen.css",
  "/multiplix/src/screens/HomeScreen.css.js",
  "/multiplix/src/screens/HomeScreen.js",
  "/multiplix/src/screens/LandingScreen.css",
  "/multiplix/src/screens/LandingScreen.css.js",
  "/multiplix/src/screens/LandingScreen.js",
  "/multiplix/src/screens/ParentDashboard.css",
  "/multiplix/src/screens/ParentDashboard.css.js",
  "/multiplix/src/screens/ParentDashboard.js",
  "/multiplix/src/screens/PrivacyScreen.css",
  "/multiplix/src/screens/PrivacyScreen.css.js",
  "/multiplix/src/screens/PrivacyScreen.js",
  "/multiplix/src/screens/ProgressScreen.css",
  "/multiplix/src/screens/ProgressScreen.css.js",
  "/multiplix/src/screens/ProgressScreen.js",
  "/multiplix/src/screens/RecapScreen.css",
  "/multiplix/src/screens/RecapScreen.css.js",
  "/multiplix/src/screens/RecapScreen.js",
  "/multiplix/src/screens/RulesIntroScreen.css",
  "/multiplix/src/screens/RulesIntroScreen.css.js",
  "/multiplix/src/screens/RulesIntroScreen.js",
  "/multiplix/src/screens/RulesScreen.css",
  "/multiplix/src/screens/RulesScreen.css.js",
  "/multiplix/src/screens/RulesScreen.js",
  "/multiplix/src/screens/SessionScreen.css",
  "/multiplix/src/screens/SessionScreen.css.js",
  "/multiplix/src/screens/SessionScreen.js",
  "/multiplix/src/screens/WelcomeScreen.css",
  "/multiplix/src/screens/WelcomeScreen.css.js",
  "/multiplix/src/screens/WelcomeScreen.js",
  "/multiplix/src/types.js",
  "/multiplix/vendor/preact/compat-client.mjs",
  "/multiplix/vendor/preact/compat.module.js",
  "/multiplix/vendor/preact/hooks.module.js",
  "/multiplix/vendor/preact/jsx-runtime.module.js",
  "/multiplix/vendor/preact/preact.module.js"
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

  // Navigation : essaie le réseau, sinon retombe sur le shell précaché.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(BASE + 'index.html'))
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

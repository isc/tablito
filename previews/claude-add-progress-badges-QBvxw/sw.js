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

const CACHE = 'multiplix-' + "20260506072106"
const BASE = "/multiplix/previews/claude-add-progress-badges-QBvxw/"
const ASSETS = [
  "/multiplix/previews/claude-add-progress-badges-QBvxw/favicon.svg",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/icons/apple-touch-icon.png",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/icons/icon-192.png",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/icons/icon-512.png",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/icons/icon.svg",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/icons.svg",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/index.html",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/App.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/App.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/App.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/badges.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/leitner.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/parseFrenchNumber.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/placement.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/sessionComposer.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/setup.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/strategies.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/streak.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/__tests__/userJourney.test.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/assets/hero.png",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/assets/react.svg",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/assets/vite.svg",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/BackChevron.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Badge.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Badge.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Badge.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/BadgeDetailModal.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/BadgeDetailModal.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/BadgeDetailModal.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/DotGrid.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/DotGrid.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/DotGrid.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ErrorBoundary.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ErrorBoundary.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ErrorBoundary.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackModal.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackModal.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackModal.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackOverlay.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackOverlay.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FeedbackOverlay.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/FlameIcon.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/IOSInstallModal.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/IOSInstallModal.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/IOSInstallModal.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Mascot.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Mascot.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Mascot.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Modal.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Modal.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/Modal.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/MysteryImage.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/MysteryImage.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/MysteryImage.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/NumPad.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/NumPad.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/NumPad.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ParentGate.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ParentGate.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ParentGate.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ProgressGrid.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ProgressGrid.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/ProgressGrid.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StrategyHint.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StrategyHint.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StrategyHint.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StreakDetailModal.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StreakDetailModal.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/StreakDetailModal.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/VoiceInput.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/VoiceInput.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/components/VoiceInput.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/env.d.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useConfetti.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useInputMode.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useInstallPrompt.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useSound.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useSpeechRecognition.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useTTS.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/hooks/useWakeLock.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/index.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/index.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/audioContext.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/badges.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/changelog.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/facts.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/feedback.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/install.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/leitner.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/micPreflight.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/parseFrenchNumber.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/placement.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/sessionComposer.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/similarity.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/storage.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/strategies.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/streak.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/lib/utils.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/main.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/BadgesScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/BadgesScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/BadgesScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ChangelogScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ChangelogScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ChangelogScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/HomeScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/HomeScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/HomeScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/LandingScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/LandingScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/LandingScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ParentDashboard.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ParentDashboard.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ParentDashboard.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/PrivacyScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/PrivacyScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/PrivacyScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ProgressScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ProgressScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/ProgressScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RecapScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RecapScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RecapScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesIntroScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesIntroScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesIntroScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/RulesScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/SessionScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/SessionScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/SessionScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/WelcomeScreen.css",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/WelcomeScreen.css.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/screens/WelcomeScreen.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/src/types.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/vendor/preact/compat-client.mjs",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/vendor/preact/compat.module.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/vendor/preact/hooks.module.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/vendor/preact/jsx-runtime.module.js",
  "/multiplix/previews/claude-add-progress-badges-QBvxw/vendor/preact/preact.module.js"
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

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
// Les caches sont séparés par cycle de vie. Le shell est versionné par build
// (son contenu doit changer à chaque déploiement) ; les médias lazy (MP3,
// images mystère, splash…) ont leur propre cache versionné par leur CONTENU,
// calculé au build. Avant, tout partageait le cache versionné par build : le
// `activate` d'une nouvelle version jetait aussi les ~13 Mo d'images mystère et
// les ~55 Mo de MP3 déjà téléchargés, qui repartaient sur le réseau au premier
// usage — d'autant plus visible que GitHub Pages sert ces fichiers en
// `max-age=600`, donc sans filet côté cache HTTP.
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

const CACHE = 'tablito-' + "20260818111830"
const BASE = "/previews/vocal-epele/"
const ASSETS = [
  "/previews/vocal-epele/CNAME",
  "/previews/vocal-epele/favicon.svg",
  "/previews/vocal-epele/fonts/fonts.css",
  "/previews/vocal-epele/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/vocal-epele/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/vocal-epele/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/vocal-epele/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/vocal-epele/icons/apple-touch-icon.png",
  "/previews/vocal-epele/icons/icon-192.png",
  "/previews/vocal-epele/icons/icon-512.png",
  "/previews/vocal-epele/icons/icon.svg",
  "/previews/vocal-epele/icons.svg",
  "/previews/vocal-epele/index.html",
  "/previews/vocal-epele/manifest.en.webmanifest",
  "/previews/vocal-epele/manifest.webmanifest",
  "/previews/vocal-epele/specs/index.html",
  "/previews/vocal-epele/src/App.js",
  "/previews/vocal-epele/src/__tests__/badges.test.js",
  "/previews/vocal-epele/src/__tests__/conjIntegration.test.js",
  "/previews/vocal-epele/src/__tests__/conjSession.test.js",
  "/previews/vocal-epele/src/__tests__/conjVoiceSession.test.js",
  "/previews/vocal-epele/src/__tests__/conjugationComposer.test.js",
  "/previews/vocal-epele/src/__tests__/conjugationFacts.test.js",
  "/previews/vocal-epele/src/__tests__/conjugationInterference.test.js",
  "/previews/vocal-epele/src/__tests__/dailyComposer.test.js",
  "/previews/vocal-epele/src/__tests__/divisionBadges.test.js",
  "/previews/vocal-epele/src/__tests__/divisionComposer.test.js",
  "/previews/vocal-epele/src/__tests__/divisionFacts.test.js",
  "/previews/vocal-epele/src/__tests__/divisionJourney.test.js",
  "/previews/vocal-epele/src/__tests__/dotGrid.test.js",
  "/previews/vocal-epele/src/__tests__/hardestFacts.test.js",
  "/previews/vocal-epele/src/__tests__/helpers/audio.js",
  "/previews/vocal-epele/src/__tests__/helpers/conjItems.js",
  "/previews/vocal-epele/src/__tests__/helpers/dom.js",
  "/previews/vocal-epele/src/__tests__/helpers/watchServer.js",
  "/previews/vocal-epele/src/__tests__/leitner.test.js",
  "/previews/vocal-epele/src/__tests__/mixedSessionTTS.test.js",
  "/previews/vocal-epele/src/__tests__/multiProfile.test.js",
  "/previews/vocal-epele/src/__tests__/parseEnglishNumber.test.js",
  "/previews/vocal-epele/src/__tests__/parseFrenchNumber.test.js",
  "/previews/vocal-epele/src/__tests__/parseSpelledLetters.test.js",
  "/previews/vocal-epele/src/__tests__/placement.test.js",
  "/previews/vocal-epele/src/__tests__/pushDismiss.test.js",
  "/previews/vocal-epele/src/__tests__/recapCelebrations.test.js",
  "/previews/vocal-epele/src/__tests__/remainderBadges.test.js",
  "/previews/vocal-epele/src/__tests__/remainderComposer.test.js",
  "/previews/vocal-epele/src/__tests__/remainderDaily.test.js",
  "/previews/vocal-epele/src/__tests__/remainderJourney.test.js",
  "/previews/vocal-epele/src/__tests__/remainderZoneLabel.test.js",
  "/previews/vocal-epele/src/__tests__/remoteFollow.test.js",
  "/previews/vocal-epele/src/__tests__/sessionComposer.test.js",
  "/previews/vocal-epele/src/__tests__/setup.js",
  "/previews/vocal-epele/src/__tests__/strategies.test.js",
  "/previews/vocal-epele/src/__tests__/streak.test.js",
  "/previews/vocal-epele/src/__tests__/transfer.test.js",
  "/previews/vocal-epele/src/__tests__/userJourney.test.js",
  "/previews/vocal-epele/src/__tests__/watch.test.js",
  "/previews/vocal-epele/src/assets/hero.png",
  "/previews/vocal-epele/src/assets/react.svg",
  "/previews/vocal-epele/src/assets/vite.svg",
  "/previews/vocal-epele/src/components/BackChevron.js",
  "/previews/vocal-epele/src/components/Badge.js",
  "/previews/vocal-epele/src/components/BadgeDetailModal.js",
  "/previews/vocal-epele/src/components/ConjFeedbackOverlay.js",
  "/previews/vocal-epele/src/components/ConjForm.js",
  "/previews/vocal-epele/src/components/ConjMysteryImage.js",
  "/previews/vocal-epele/src/components/ConjProgressGrid.js",
  "/previews/vocal-epele/src/components/ConjVoiceInput.js",
  "/previews/vocal-epele/src/components/DivisionMysteryImage.js",
  "/previews/vocal-epele/src/components/DivisionProgressGrid.js",
  "/previews/vocal-epele/src/components/DivisionStrategyHint.js",
  "/previews/vocal-epele/src/components/DotGrid.js",
  "/previews/vocal-epele/src/components/ErrorBoundary.js",
  "/previews/vocal-epele/src/components/EvolutionChart.js",
  "/previews/vocal-epele/src/components/Feather.js",
  "/previews/vocal-epele/src/components/FeedbackModal.js",
  "/previews/vocal-epele/src/components/FeedbackOverlay.js",
  "/previews/vocal-epele/src/components/FeedbackStar.js",
  "/previews/vocal-epele/src/components/FlameIcon.js",
  "/previews/vocal-epele/src/components/LanguageToggle.js",
  "/previews/vocal-epele/src/components/LeitnerGrid.js",
  "/previews/vocal-epele/src/components/LetterKeyboard.js",
  "/previews/vocal-epele/src/components/Mascot.js",
  "/previews/vocal-epele/src/components/Modal.js",
  "/previews/vocal-epele/src/components/MysteryGrid.js",
  "/previews/vocal-epele/src/components/MysteryImage.js",
  "/previews/vocal-epele/src/components/NotificationSettings.js",
  "/previews/vocal-epele/src/components/NumPad.js",
  "/previews/vocal-epele/src/components/ParentGate.js",
  "/previews/vocal-epele/src/components/ParentStats.js",
  "/previews/vocal-epele/src/components/ProgressGrid.js",
  "/previews/vocal-epele/src/components/PushToggle.js",
  "/previews/vocal-epele/src/components/QrCanvas.js",
  "/previews/vocal-epele/src/components/RemainderMysteryImage.js",
  "/previews/vocal-epele/src/components/RemainderProgressGrid.js",
  "/previews/vocal-epele/src/components/RemainderStrategyHint.js",
  "/previews/vocal-epele/src/components/StrategyHint.js",
  "/previews/vocal-epele/src/components/StrategyHintShell.js",
  "/previews/vocal-epele/src/components/StreakDetailModal.js",
  "/previews/vocal-epele/src/components/VoiceInput.js",
  "/previews/vocal-epele/src/components/VoiceInput.test.js",
  "/previews/vocal-epele/src/components/WeeklyRecapSettings.js",
  "/previews/vocal-epele/src/components/conjHintLine.js",
  "/previews/vocal-epele/src/env.d.js",
  "/previews/vocal-epele/src/hooks/useConfetti.js",
  "/previews/vocal-epele/src/hooks/useInputMode.js",
  "/previews/vocal-epele/src/hooks/useLatestRef.js",
  "/previews/vocal-epele/src/hooks/usePushPref.js",
  "/previews/vocal-epele/src/hooks/useQrScan.js",
  "/previews/vocal-epele/src/hooks/useSound.js",
  "/previews/vocal-epele/src/hooks/useSpeechRecognition.js",
  "/previews/vocal-epele/src/hooks/useSpeechRecognition.test.js",
  "/previews/vocal-epele/src/hooks/useTTS.js",
  "/previews/vocal-epele/src/hooks/useWakeLock.js",
  "/previews/vocal-epele/src/i18n/LangProvider.js",
  "/previews/vocal-epele/src/i18n/app.js",
  "/previews/vocal-epele/src/i18n/badges.js",
  "/previews/vocal-epele/src/i18n/changelog.js",
  "/previews/vocal-epele/src/i18n/conjugation.js",
  "/previews/vocal-epele/src/i18n/home.js",
  "/previews/vocal-epele/src/i18n/lang.js",
  "/previews/vocal-epele/src/i18n/language.js",
  "/previews/vocal-epele/src/i18n/onboarding.js",
  "/previews/vocal-epele/src/i18n/parent.js",
  "/previews/vocal-epele/src/i18n/privacy.js",
  "/previews/vocal-epele/src/i18n/progress.js",
  "/previews/vocal-epele/src/i18n/recap.js",
  "/previews/vocal-epele/src/i18n/session.js",
  "/previews/vocal-epele/src/i18n/strategies.js",
  "/previews/vocal-epele/src/i18n/voice.js",
  "/previews/vocal-epele/src/lib/audioContext.js",
  "/previews/vocal-epele/src/lib/badges.js",
  "/previews/vocal-epele/src/lib/changelog.js",
  "/previews/vocal-epele/src/lib/codec.js",
  "/previews/vocal-epele/src/lib/conjugationComposer.js",
  "/previews/vocal-epele/src/lib/conjugationFacts.js",
  "/previews/vocal-epele/src/lib/conjugationInterference.js",
  "/previews/vocal-epele/src/lib/conjugationPlacement.js",
  "/previews/vocal-epele/src/lib/conjugationStrategies.js",
  "/previews/vocal-epele/src/lib/dailyComposer.js",
  "/previews/vocal-epele/src/lib/debugTools.js",
  "/previews/vocal-epele/src/lib/divisionComposer.js",
  "/previews/vocal-epele/src/lib/divisionFacts.js",
  "/previews/vocal-epele/src/lib/divisionStrategies.js",
  "/previews/vocal-epele/src/lib/facts.js",
  "/previews/vocal-epele/src/lib/feedback.js",
  "/previews/vocal-epele/src/lib/hardestFacts.js",
  "/previews/vocal-epele/src/lib/install.js",
  "/previews/vocal-epele/src/lib/leitner.js",
  "/previews/vocal-epele/src/lib/letterNames.js",
  "/previews/vocal-epele/src/lib/micPreflight.js",
  "/previews/vocal-epele/src/lib/parseEnglishNumber.js",
  "/previews/vocal-epele/src/lib/parseFrenchNumber.js",
  "/previews/vocal-epele/src/lib/parseSpelledLetters.js",
  "/previews/vocal-epele/src/lib/parseSpokenNumber.js",
  "/previews/vocal-epele/src/lib/phoneticDict.js",
  "/previews/vocal-epele/src/lib/placement.js",
  "/previews/vocal-epele/src/lib/push.js",
  "/previews/vocal-epele/src/lib/remainderComposer.js",
  "/previews/vocal-epele/src/lib/remainderFacts.js",
  "/previews/vocal-epele/src/lib/remainderStrategies.js",
  "/previews/vocal-epele/src/lib/sessionComposer.js",
  "/previews/vocal-epele/src/lib/sessionItemView.js",
  "/previews/vocal-epele/src/lib/similarity.js",
  "/previews/vocal-epele/src/lib/spokenNumber.js",
  "/previews/vocal-epele/src/lib/storage.js",
  "/previews/vocal-epele/src/lib/strategies.js",
  "/previews/vocal-epele/src/lib/streak.js",
  "/previews/vocal-epele/src/lib/supabase.js",
  "/previews/vocal-epele/src/lib/transfer.js",
  "/previews/vocal-epele/src/lib/utils.js",
  "/previews/vocal-epele/src/lib/voiceDebug.js",
  "/previews/vocal-epele/src/lib/watch.js",
  "/previews/vocal-epele/src/lib/watchStore.js",
  "/previews/vocal-epele/src/main.js",
  "/previews/vocal-epele/src/screens/BadgesScreen.js",
  "/previews/vocal-epele/src/screens/ChangelogScreen.js",
  "/previews/vocal-epele/src/screens/ConjPlacementScreen.js",
  "/previews/vocal-epele/src/screens/HomeScreen.js",
  "/previews/vocal-epele/src/screens/ParentDashboard.js",
  "/previews/vocal-epele/src/screens/PrivacyScreen.js",
  "/previews/vocal-epele/src/screens/ProfileSelectScreen.js",
  "/previews/vocal-epele/src/screens/ProgressScreen.js",
  "/previews/vocal-epele/src/screens/RecapScreen.js",
  "/previews/vocal-epele/src/screens/RulesIntroScreen.js",
  "/previews/vocal-epele/src/screens/RulesScreen.js",
  "/previews/vocal-epele/src/screens/SessionScreen.js",
  "/previews/vocal-epele/src/screens/WelcomeScreen.js",
  "/previews/vocal-epele/src/types.js",
  "/previews/vocal-epele/styles.css",
  "/previews/vocal-epele/vendor/lean-qr/index.mjs",
  "/previews/vocal-epele/vendor/preact/compat-client.mjs",
  "/previews/vocal-epele/vendor/preact/compat.module.js",
  "/previews/vocal-epele/vendor/preact/hooks.module.js",
  "/previews/vocal-epele/vendor/preact/jsx-runtime.module.js",
  "/previews/vocal-epele/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/vocal-epele/audio/"],"media":["/previews/vocal-epele/mystery/","/previews/vocal-epele/splash/","/previews/vocal-epele/video/","/previews/vocal-epele/vendor/qr-scanner/","/previews/vocal-epele/img/hero-poster"],"phonetic":["/previews/vocal-epele/phonetic/"]}
const LAZY_VERSIONS = {"audio":"c219a8e6c9a0","media":"b0361ec4d40b","phonetic":"fa4ee22f5b55"}

const LAZY_CACHES = {}
for (const group of Object.keys(LAZY_GROUPS)) {
  LAZY_CACHES[group] = 'tablito-' + group + '-' + LAZY_VERSIONS[group]
}
const KEEP = [CACHE].concat(Object.values(LAZY_CACHES))

// Cache d'écriture d'une réponse lazy-cachée. Tout ce qui n'est pas un média
// (pages du guide, specs…) retombe sur le cache shell, donc suit le cycle de vie
// des déploiements comme avant.
function cacheNameFor(pathname) {
  for (const group of Object.keys(LAZY_GROUPS)) {
    if (LAZY_GROUPS[group].some((p) => pathname.startsWith(p))) return LAZY_CACHES[group]
  }
  return CACHE
}

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
      .then((keys) => Promise.all(keys.filter((k) => KEEP.indexOf(k) === -1).map((k) => caches.delete(k))))
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
        caches.open(cacheNameFor(url.pathname)).then((c) => c.put(e.request, clone))
      }
      return res
    }))
  )
})

// Push : rappel quotidien de séance ou recap hebdomadaire du suivi à distance
// (cf. scripts/send-reminders.mjs). Le payload est un JSON {title, body, url,
// tag}. Fallback défensif si le payload manque/est illisible.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = {} }
  const title = data.title || 'Tablito'
  const body = data.body || "C'est l'heure de ta séance Tablito ! 🎯"
  const url = data.url || BASE
  // Un tag par type : au sein d'un type, une notif non lue est remplacée plutôt
  // qu'empilée — mais un recap ne doit pas effacer un rappel de séance, ni
  // l'inverse (ils ne s'adressent même pas à la même personne).
  const tag = data.tag || 'daily-reminder'
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      tag,
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
        if (!('focus' in c)) continue
        // Une app déjà ouverte reprend là où elle en était : sans navigation, le
        // fragment de la notification serait ignoré et le parent retomberait sur
        // l'écran précédent au lieu du recap. On ne navigue QUE dans ce cas — le
        // rappel quotidien pointe sur la racine, et rediriger un enfant en pleine
        // séance lui ferait perdre sa séance.
        const needsNavigate = 'navigate' in c && target !== BASE && c.url !== target
        if (!needsNavigate) return c.focus()
        // navigate() REJETTE sur un client non contrôlé par ce SW — et matchAll
        // ci-dessus inclut volontairement les non contrôlés. Sans ce catch, le
        // rejet remonte au waitUntil et le clic ne fait plus rien du tout.
        return c
          .navigate(target)
          .then((n) => (n || c).focus())
          .catch(() => c.focus())
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})

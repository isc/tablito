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

const CACHE = 'tablito-' + "20260817115618"
const BASE = "/previews/conjugaison/"
const ASSETS = [
  "/previews/conjugaison/CNAME",
  "/previews/conjugaison/favicon.svg",
  "/previews/conjugaison/fonts/fonts.css",
  "/previews/conjugaison/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/conjugaison/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/conjugaison/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/conjugaison/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/conjugaison/icons/apple-touch-icon.png",
  "/previews/conjugaison/icons/icon-192.png",
  "/previews/conjugaison/icons/icon-512.png",
  "/previews/conjugaison/icons/icon.svg",
  "/previews/conjugaison/icons.svg",
  "/previews/conjugaison/index.html",
  "/previews/conjugaison/manifest.en.webmanifest",
  "/previews/conjugaison/manifest.webmanifest",
  "/previews/conjugaison/specs/index.html",
  "/previews/conjugaison/src/App.js",
  "/previews/conjugaison/src/__tests__/badges.test.js",
  "/previews/conjugaison/src/__tests__/conjIntegration.test.js",
  "/previews/conjugaison/src/__tests__/conjSession.test.js",
  "/previews/conjugaison/src/__tests__/conjugationComposer.test.js",
  "/previews/conjugaison/src/__tests__/conjugationFacts.test.js",
  "/previews/conjugaison/src/__tests__/conjugationInterference.test.js",
  "/previews/conjugaison/src/__tests__/dailyComposer.test.js",
  "/previews/conjugaison/src/__tests__/divisionBadges.test.js",
  "/previews/conjugaison/src/__tests__/divisionComposer.test.js",
  "/previews/conjugaison/src/__tests__/divisionFacts.test.js",
  "/previews/conjugaison/src/__tests__/divisionJourney.test.js",
  "/previews/conjugaison/src/__tests__/dotGrid.test.js",
  "/previews/conjugaison/src/__tests__/hardestFacts.test.js",
  "/previews/conjugaison/src/__tests__/helpers/dom.js",
  "/previews/conjugaison/src/__tests__/helpers/watchServer.js",
  "/previews/conjugaison/src/__tests__/leitner.test.js",
  "/previews/conjugaison/src/__tests__/mixedSessionTTS.test.js",
  "/previews/conjugaison/src/__tests__/multiProfile.test.js",
  "/previews/conjugaison/src/__tests__/parseEnglishNumber.test.js",
  "/previews/conjugaison/src/__tests__/parseFrenchNumber.test.js",
  "/previews/conjugaison/src/__tests__/placement.test.js",
  "/previews/conjugaison/src/__tests__/pushDismiss.test.js",
  "/previews/conjugaison/src/__tests__/recapCelebrations.test.js",
  "/previews/conjugaison/src/__tests__/remainderBadges.test.js",
  "/previews/conjugaison/src/__tests__/remainderComposer.test.js",
  "/previews/conjugaison/src/__tests__/remainderDaily.test.js",
  "/previews/conjugaison/src/__tests__/remainderJourney.test.js",
  "/previews/conjugaison/src/__tests__/remainderZoneLabel.test.js",
  "/previews/conjugaison/src/__tests__/remoteFollow.test.js",
  "/previews/conjugaison/src/__tests__/sessionComposer.test.js",
  "/previews/conjugaison/src/__tests__/setup.js",
  "/previews/conjugaison/src/__tests__/strategies.test.js",
  "/previews/conjugaison/src/__tests__/streak.test.js",
  "/previews/conjugaison/src/__tests__/transfer.test.js",
  "/previews/conjugaison/src/__tests__/userJourney.test.js",
  "/previews/conjugaison/src/__tests__/watch.test.js",
  "/previews/conjugaison/src/assets/hero.png",
  "/previews/conjugaison/src/assets/react.svg",
  "/previews/conjugaison/src/assets/vite.svg",
  "/previews/conjugaison/src/components/BackChevron.js",
  "/previews/conjugaison/src/components/Badge.js",
  "/previews/conjugaison/src/components/BadgeDetailModal.js",
  "/previews/conjugaison/src/components/ConjFeedbackOverlay.js",
  "/previews/conjugaison/src/components/ConjForm.js",
  "/previews/conjugaison/src/components/ConjMysteryImage.js",
  "/previews/conjugaison/src/components/ConjProgressGrid.js",
  "/previews/conjugaison/src/components/DivisionMysteryImage.js",
  "/previews/conjugaison/src/components/DivisionProgressGrid.js",
  "/previews/conjugaison/src/components/DivisionStrategyHint.js",
  "/previews/conjugaison/src/components/DotGrid.js",
  "/previews/conjugaison/src/components/ErrorBoundary.js",
  "/previews/conjugaison/src/components/EvolutionChart.js",
  "/previews/conjugaison/src/components/Feather.js",
  "/previews/conjugaison/src/components/FeedbackModal.js",
  "/previews/conjugaison/src/components/FeedbackOverlay.js",
  "/previews/conjugaison/src/components/FeedbackStar.js",
  "/previews/conjugaison/src/components/FlameIcon.js",
  "/previews/conjugaison/src/components/LanguageToggle.js",
  "/previews/conjugaison/src/components/LeitnerGrid.js",
  "/previews/conjugaison/src/components/LetterKeyboard.js",
  "/previews/conjugaison/src/components/Mascot.js",
  "/previews/conjugaison/src/components/Modal.js",
  "/previews/conjugaison/src/components/MysteryGrid.js",
  "/previews/conjugaison/src/components/MysteryImage.js",
  "/previews/conjugaison/src/components/NotificationSettings.js",
  "/previews/conjugaison/src/components/NumPad.js",
  "/previews/conjugaison/src/components/ParentGate.js",
  "/previews/conjugaison/src/components/ParentStats.js",
  "/previews/conjugaison/src/components/ProgressGrid.js",
  "/previews/conjugaison/src/components/PushToggle.js",
  "/previews/conjugaison/src/components/QrCanvas.js",
  "/previews/conjugaison/src/components/RemainderMysteryImage.js",
  "/previews/conjugaison/src/components/RemainderProgressGrid.js",
  "/previews/conjugaison/src/components/RemainderStrategyHint.js",
  "/previews/conjugaison/src/components/StrategyHint.js",
  "/previews/conjugaison/src/components/StrategyHintShell.js",
  "/previews/conjugaison/src/components/StreakDetailModal.js",
  "/previews/conjugaison/src/components/VoiceInput.js",
  "/previews/conjugaison/src/components/VoiceInput.test.js",
  "/previews/conjugaison/src/components/WeeklyRecapSettings.js",
  "/previews/conjugaison/src/env.d.js",
  "/previews/conjugaison/src/hooks/useConfetti.js",
  "/previews/conjugaison/src/hooks/useInputMode.js",
  "/previews/conjugaison/src/hooks/usePushPref.js",
  "/previews/conjugaison/src/hooks/useQrScan.js",
  "/previews/conjugaison/src/hooks/useSound.js",
  "/previews/conjugaison/src/hooks/useSpeechRecognition.js",
  "/previews/conjugaison/src/hooks/useSpeechRecognition.test.js",
  "/previews/conjugaison/src/hooks/useTTS.js",
  "/previews/conjugaison/src/hooks/useWakeLock.js",
  "/previews/conjugaison/src/i18n/LangProvider.js",
  "/previews/conjugaison/src/i18n/app.js",
  "/previews/conjugaison/src/i18n/badges.js",
  "/previews/conjugaison/src/i18n/changelog.js",
  "/previews/conjugaison/src/i18n/conjugation.js",
  "/previews/conjugaison/src/i18n/home.js",
  "/previews/conjugaison/src/i18n/lang.js",
  "/previews/conjugaison/src/i18n/language.js",
  "/previews/conjugaison/src/i18n/onboarding.js",
  "/previews/conjugaison/src/i18n/parent.js",
  "/previews/conjugaison/src/i18n/privacy.js",
  "/previews/conjugaison/src/i18n/progress.js",
  "/previews/conjugaison/src/i18n/recap.js",
  "/previews/conjugaison/src/i18n/session.js",
  "/previews/conjugaison/src/i18n/strategies.js",
  "/previews/conjugaison/src/i18n/voice.js",
  "/previews/conjugaison/src/lib/audioContext.js",
  "/previews/conjugaison/src/lib/badges.js",
  "/previews/conjugaison/src/lib/changelog.js",
  "/previews/conjugaison/src/lib/codec.js",
  "/previews/conjugaison/src/lib/conjugationComposer.js",
  "/previews/conjugaison/src/lib/conjugationFacts.js",
  "/previews/conjugaison/src/lib/conjugationInterference.js",
  "/previews/conjugaison/src/lib/conjugationPlacement.js",
  "/previews/conjugaison/src/lib/conjugationStrategies.js",
  "/previews/conjugaison/src/lib/dailyComposer.js",
  "/previews/conjugaison/src/lib/debugTools.js",
  "/previews/conjugaison/src/lib/divisionComposer.js",
  "/previews/conjugaison/src/lib/divisionFacts.js",
  "/previews/conjugaison/src/lib/divisionStrategies.js",
  "/previews/conjugaison/src/lib/facts.js",
  "/previews/conjugaison/src/lib/feedback.js",
  "/previews/conjugaison/src/lib/hardestFacts.js",
  "/previews/conjugaison/src/lib/install.js",
  "/previews/conjugaison/src/lib/leitner.js",
  "/previews/conjugaison/src/lib/micPreflight.js",
  "/previews/conjugaison/src/lib/parseEnglishNumber.js",
  "/previews/conjugaison/src/lib/parseFrenchNumber.js",
  "/previews/conjugaison/src/lib/parseSpokenNumber.js",
  "/previews/conjugaison/src/lib/placement.js",
  "/previews/conjugaison/src/lib/push.js",
  "/previews/conjugaison/src/lib/remainderComposer.js",
  "/previews/conjugaison/src/lib/remainderFacts.js",
  "/previews/conjugaison/src/lib/remainderStrategies.js",
  "/previews/conjugaison/src/lib/sessionComposer.js",
  "/previews/conjugaison/src/lib/sessionItemView.js",
  "/previews/conjugaison/src/lib/similarity.js",
  "/previews/conjugaison/src/lib/spokenNumber.js",
  "/previews/conjugaison/src/lib/storage.js",
  "/previews/conjugaison/src/lib/strategies.js",
  "/previews/conjugaison/src/lib/streak.js",
  "/previews/conjugaison/src/lib/supabase.js",
  "/previews/conjugaison/src/lib/transfer.js",
  "/previews/conjugaison/src/lib/utils.js",
  "/previews/conjugaison/src/lib/voiceDebug.js",
  "/previews/conjugaison/src/lib/watch.js",
  "/previews/conjugaison/src/lib/watchStore.js",
  "/previews/conjugaison/src/main.js",
  "/previews/conjugaison/src/screens/BadgesScreen.js",
  "/previews/conjugaison/src/screens/ChangelogScreen.js",
  "/previews/conjugaison/src/screens/ConjPlacementScreen.js",
  "/previews/conjugaison/src/screens/HomeScreen.js",
  "/previews/conjugaison/src/screens/ParentDashboard.js",
  "/previews/conjugaison/src/screens/PrivacyScreen.js",
  "/previews/conjugaison/src/screens/ProfileSelectScreen.js",
  "/previews/conjugaison/src/screens/ProgressScreen.js",
  "/previews/conjugaison/src/screens/RecapScreen.js",
  "/previews/conjugaison/src/screens/RulesIntroScreen.js",
  "/previews/conjugaison/src/screens/RulesScreen.js",
  "/previews/conjugaison/src/screens/SessionScreen.js",
  "/previews/conjugaison/src/screens/WelcomeScreen.js",
  "/previews/conjugaison/src/types.js",
  "/previews/conjugaison/styles.css",
  "/previews/conjugaison/vendor/lean-qr/index.mjs",
  "/previews/conjugaison/vendor/preact/compat-client.mjs",
  "/previews/conjugaison/vendor/preact/compat.module.js",
  "/previews/conjugaison/vendor/preact/hooks.module.js",
  "/previews/conjugaison/vendor/preact/jsx-runtime.module.js",
  "/previews/conjugaison/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/conjugaison/audio/"],"media":["/previews/conjugaison/mystery/","/previews/conjugaison/splash/","/previews/conjugaison/video/","/previews/conjugaison/vendor/qr-scanner/","/previews/conjugaison/img/hero-poster"]}
const LAZY_VERSIONS = {"audio":"7351114b1678","media":"2387459ab3c6"}

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

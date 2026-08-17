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

const CACHE = 'tablito-' + "20260817171132"
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
  "/src/__tests__/conjIntegration.test.js",
  "/src/__tests__/conjSession.test.js",
  "/src/__tests__/conjugationComposer.test.js",
  "/src/__tests__/conjugationFacts.test.js",
  "/src/__tests__/conjugationInterference.test.js",
  "/src/__tests__/dailyComposer.test.js",
  "/src/__tests__/divisionBadges.test.js",
  "/src/__tests__/divisionComposer.test.js",
  "/src/__tests__/divisionFacts.test.js",
  "/src/__tests__/divisionJourney.test.js",
  "/src/__tests__/dotGrid.test.js",
  "/src/__tests__/hardestFacts.test.js",
  "/src/__tests__/helpers/dom.js",
  "/src/__tests__/helpers/watchServer.js",
  "/src/__tests__/leitner.test.js",
  "/src/__tests__/mixedSessionTTS.test.js",
  "/src/__tests__/multiProfile.test.js",
  "/src/__tests__/parseEnglishNumber.test.js",
  "/src/__tests__/parseFrenchNumber.test.js",
  "/src/__tests__/placement.test.js",
  "/src/__tests__/pushDismiss.test.js",
  "/src/__tests__/recapCelebrations.test.js",
  "/src/__tests__/remainderBadges.test.js",
  "/src/__tests__/remainderComposer.test.js",
  "/src/__tests__/remainderDaily.test.js",
  "/src/__tests__/remainderJourney.test.js",
  "/src/__tests__/remainderZoneLabel.test.js",
  "/src/__tests__/remoteFollow.test.js",
  "/src/__tests__/sessionComposer.test.js",
  "/src/__tests__/setup.js",
  "/src/__tests__/strategies.test.js",
  "/src/__tests__/streak.test.js",
  "/src/__tests__/transfer.test.js",
  "/src/__tests__/userJourney.test.js",
  "/src/__tests__/watch.test.js",
  "/src/assets/hero.png",
  "/src/assets/react.svg",
  "/src/assets/vite.svg",
  "/src/components/BackChevron.js",
  "/src/components/Badge.js",
  "/src/components/BadgeDetailModal.js",
  "/src/components/ConjFeedbackOverlay.js",
  "/src/components/ConjForm.js",
  "/src/components/ConjMysteryImage.js",
  "/src/components/ConjProgressGrid.js",
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
  "/src/components/LetterKeyboard.js",
  "/src/components/Mascot.js",
  "/src/components/Modal.js",
  "/src/components/MysteryGrid.js",
  "/src/components/MysteryImage.js",
  "/src/components/NotificationSettings.js",
  "/src/components/NumPad.js",
  "/src/components/ParentGate.js",
  "/src/components/ParentStats.js",
  "/src/components/ProgressGrid.js",
  "/src/components/PushToggle.js",
  "/src/components/QrCanvas.js",
  "/src/components/RemainderMysteryImage.js",
  "/src/components/RemainderProgressGrid.js",
  "/src/components/RemainderStrategyHint.js",
  "/src/components/StrategyHint.js",
  "/src/components/StrategyHintShell.js",
  "/src/components/StreakDetailModal.js",
  "/src/components/VoiceInput.js",
  "/src/components/VoiceInput.test.js",
  "/src/components/WeeklyRecapSettings.js",
  "/src/env.d.js",
  "/src/hooks/useConfetti.js",
  "/src/hooks/useInputMode.js",
  "/src/hooks/usePushPref.js",
  "/src/hooks/useQrScan.js",
  "/src/hooks/useSound.js",
  "/src/hooks/useSpeechRecognition.js",
  "/src/hooks/useSpeechRecognition.test.js",
  "/src/hooks/useTTS.js",
  "/src/hooks/useWakeLock.js",
  "/src/i18n/LangProvider.js",
  "/src/i18n/app.js",
  "/src/i18n/badges.js",
  "/src/i18n/changelog.js",
  "/src/i18n/conjugation.js",
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
  "/src/lib/codec.js",
  "/src/lib/conjugationComposer.js",
  "/src/lib/conjugationFacts.js",
  "/src/lib/conjugationInterference.js",
  "/src/lib/conjugationPlacement.js",
  "/src/lib/conjugationStrategies.js",
  "/src/lib/dailyComposer.js",
  "/src/lib/debugTools.js",
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
  "/src/lib/remainderComposer.js",
  "/src/lib/remainderFacts.js",
  "/src/lib/remainderStrategies.js",
  "/src/lib/sessionComposer.js",
  "/src/lib/sessionItemView.js",
  "/src/lib/similarity.js",
  "/src/lib/spokenNumber.js",
  "/src/lib/storage.js",
  "/src/lib/strategies.js",
  "/src/lib/streak.js",
  "/src/lib/supabase.js",
  "/src/lib/transfer.js",
  "/src/lib/utils.js",
  "/src/lib/voiceDebug.js",
  "/src/lib/watch.js",
  "/src/lib/watchStore.js",
  "/src/main.js",
  "/src/screens/BadgesScreen.js",
  "/src/screens/ChangelogScreen.js",
  "/src/screens/ConjPlacementScreen.js",
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
  "/vendor/lean-qr/index.mjs",
  "/vendor/preact/compat-client.mjs",
  "/vendor/preact/compat.module.js",
  "/vendor/preact/hooks.module.js",
  "/vendor/preact/jsx-runtime.module.js",
  "/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/audio/"],"media":["/mystery/","/splash/","/video/","/vendor/qr-scanner/","/img/hero-poster"]}
const LAZY_VERSIONS = {"audio":"c219a8e6c9a0","media":"b0361ec4d40b"}

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
